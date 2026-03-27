#!/usr/bin/env node

/**
 * CheckOps v4.0.0 Automated Migration Script (Non-Interactive)
 * 
 * This script runs the migration without user prompts.
 * Use this when you've already confirmed prerequisites.
 * 
 * Usage:
 *   node scripts/migrate-v4-auto.js
 * 
 * Or with environment variables:
 *   DB_HOST=localhost DB_PORT=5432 DB_NAME=checkops DB_USER=postgres DB_PASSWORD=postgres node scripts/migrate-v4-auto.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

// Get database configuration from environment
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'checkops',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
};

async function runMigration(pool, migrationFile, step) {
    log(`\n[${step}/5] Running ${migrationFile}...`, 'cyan');

    try {
        const migrationPath = join(__dirname, '..', 'migrations', migrationFile);
        const sql = readFileSync(migrationPath, 'utf8');

        // Split SQL into statements, handling DO blocks properly
        // Execute the entire file as one transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Split by semicolons but preserve DO blocks
            const statements = sql.split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/)
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                if (statement) {
                    await client.query(statement);
                }
            }

            await client.query('COMMIT');
            logSuccess(`${migrationFile} completed`);
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        logError(`${migrationFile} failed: ${error.message}`);
        log('\nError details:', 'red');
        log(error.stack, 'red');
        return false;
    }
}

async function verifyMigration(pool) {
    log('\n[6/6] Verifying migration...', 'cyan');

    try {
        // Check schema
        const schemaResult = await pool.query(`
            SELECT 
                table_name,
                column_name,
                data_type
            FROM information_schema.columns
            WHERE table_name IN ('forms', 'question_bank', 'submissions')
                AND column_name IN ('id', 'sid')
            ORDER BY table_name, column_name
        `);

        const expectedSchema = [
            { table_name: 'forms', column_name: 'id', data_type: 'uuid' },
            { table_name: 'forms', column_name: 'sid', data_type: 'character varying' },
            { table_name: 'question_bank', column_name: 'id', data_type: 'uuid' },
            { table_name: 'question_bank', column_name: 'sid', data_type: 'character varying' },
            { table_name: 'submissions', column_name: 'id', data_type: 'uuid' },
            { table_name: 'submissions', column_name: 'sid', data_type: 'character varying' },
        ];

        let schemaValid = true;
        for (const expected of expectedSchema) {
            const found = schemaResult.rows.find(
                row => row.table_name === expected.table_name &&
                    row.column_name === expected.column_name &&
                    row.data_type === expected.data_type
            );

            if (!found) {
                logError(`Schema mismatch: ${expected.table_name}.${expected.column_name} should be ${expected.data_type}`);
                schemaValid = false;
            }
        }

        if (!schemaValid) {
            return false;
        }

        logSuccess('Schema verification passed');

        // Check foreign keys
        const fkResult = await pool.query(`
            SELECT COUNT(*) as violations
            FROM submissions s
            LEFT JOIN forms f ON s.form_id = f.id
            WHERE f.id IS NULL
        `);

        const violations = parseInt(fkResult.rows[0].violations, 10);

        if (violations > 0) {
            logError(`${violations} foreign key violation(s) detected`);
            return false;
        }

        logSuccess('Foreign key integrity verified');

        // Check record counts
        const formsCount = await pool.query('SELECT COUNT(*) as count FROM forms');
        const questionsCount = await pool.query('SELECT COUNT(*) as count FROM question_bank');
        const submissionsCount = await pool.query('SELECT COUNT(*) as count FROM submissions');

        log('\nRecord counts:', 'bright');
        log(`  Forms: ${formsCount.rows[0].count}`);
        log(`  Questions: ${questionsCount.rows[0].count}`);
        log(`  Submissions: ${submissionsCount.rows[0].count}`);

        logSuccess('Migration verification passed');
        return true;
    } catch (error) {
        logError(`Verification failed: ${error.message}`);
        return false;
    }
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║    CheckOps v4.0.0 Automated Migration (Non-Interactive)  ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

    log('Database Configuration:', 'bright');
    log(`  Host: ${dbConfig.host}`);
    log(`  Port: ${dbConfig.port}`);
    log(`  Database: ${dbConfig.database}`);
    log(`  User: ${dbConfig.user}\n`);

    const pool = new Pool(dbConfig);

    try {
        // Test connection
        await pool.query('SELECT 1');
        logSuccess('Database connection established\n');

        log('='.repeat(60), 'bright');
        log('Starting migration...', 'bright');
        log('='.repeat(60) + '\n', 'bright');

        // Run migrations
        const migrations = [
            '006_add_uuid_columns.sql',
            '007_migrate_foreign_keys.sql',
            '008_swap_primary_keys.sql',
            '009_cleanup_and_optimize.sql',
            '010_add_form_sid_to_submissions.sql',
        ];

        for (let i = 0; i < migrations.length; i++) {
            if (!await runMigration(pool, migrations[i], i + 1)) {
                throw new Error(`Migration ${migrations[i]} failed`);
            }
        }

        // Verify migration
        if (!await verifyMigration(pool)) {
            throw new Error('Migration verification failed');
        }

        log('\n' + '='.repeat(60), 'green');
        log('✓ Migration completed successfully!', 'green');
        log('='.repeat(60) + '\n', 'green');

        log('Next steps:', 'bright');
        log('  1. Run integration tests: npm test -- tests/integration');
        log('  2. Update performance tests if integration tests pass');
        log('  3. Run full test suite: npm test\n');

        await pool.end();
        process.exit(0);
    } catch (error) {
        log('\n' + '='.repeat(60), 'red');
        log('✗ Migration failed!', 'red');
        log('='.repeat(60) + '\n', 'red');

        logError(error.message);

        log('\nRollback options:', 'yellow');
        log('  Run rollback script:', 'yellow');
        log(`  psql -U ${dbConfig.user} -d ${dbConfig.database} -f migrations/rollback_v4.sql\n`, 'yellow');

        await pool.end();
        process.exit(1);
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    log('\n\nMigration interrupted by user', 'yellow');
    process.exit(1);
});

main();
