import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL error codes that mean "this object already exists".
// When a migration fails with one of these codes, it was already applied on
// this database before the tracking table existed.  We record it as done and
// move on rather than aborting the run.
//
//   42701  duplicate_column     — ADD COLUMN for a column that already exists
//   42P07  duplicate_table      — CREATE TABLE for a table that already exists
//   42710  duplicate_object     — CREATE INDEX / TRIGGER / CONSTRAINT that exists
const ALREADY_EXISTS_CODES = new Set(['42701', '42P07', '42710']);

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'checkops',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  // Acquire a single connection so BEGIN/COMMIT/ROLLBACK work correctly.
  const client = await pool.connect();

  try {
    console.log('Starting database migrations...');

    // ── Migration tracking table ─────────────────────────────────────────
    // Each row records one SQL file that has been successfully applied.
    // Once a filename appears here, the runner will never attempt it again.
    await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT        PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

    // ── Auto-discover migration files ────────────────────────────────────
    // Any file whose name starts with one or more digits followed by an
    // underscore is treated as a migration (e.g. 019_add_form_visibility.sql).
    // Files are sorted numerically so they always apply in the right order.
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)[1], 10);
        const numB = parseInt(b.match(/^(\d+)/)[1], 10);
        return numA - numB;
      });

    console.log(`Found ${migrationFiles.length} migration file(s).`);

    // ── Apply each migration ─────────────────────────────────────────────
    for (const file of migrationFiles) {
      // Skip if already recorded in the tracking table.
      const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      try {
        // Wrap every migration in a transaction so that a mid-migration
        // failure leaves the database in a clean state — not a half-applied one.
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✓     ${file}`);
      } catch (err) {
        // Roll back whatever this migration attempted before it failed.
        await client.query('ROLLBACK');

        if (ALREADY_EXISTS_CODES.has(err.code)) {
          // The failure means the schema change is already in place — the
          // migration was applied to this database before the tracking table
          // existed (e.g. via a manual script or a previous runner version).
          // Record it as done so we never try it again.
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
          console.log(`  skip  ${file} (schema already present — marked as applied)`);
        } else {
          // A genuine, unexpected error.  Surface it immediately so the
          // operator knows exactly which migration failed and why.
          console.error(`  FAIL  ${file}: [${err.code}] ${err.message}`);
          throw err;
        }
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration run aborted:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
