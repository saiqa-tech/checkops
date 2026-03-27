#!/usr/bin/env node

/**
 * CheckOps v4.0.0 Migration Script
 * 
 * This script automates the migration from v3.x to v4.0.0 dual-ID system.
 * 
 * Usage:
 *   node scripts/migrate-v4.js
 * 
 * Or with environment variables:
 *   DB_HOST=localhost DB_PORT=5432 DB_NAME=checkops_db DB_USER=postgres DB_PASSWORD=password node scripts/migrate-v4.js
 * 
 * Prerequisites:
 *   - Database backup created
 *   - Application stopped
 *   - PostgreSQL 12+ installed
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import readline from 'readline';

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
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n[${step}/9] ${message}`, 'cyan');
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow');
}

// Get database configuration from environment
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'checkops_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
};

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function checkPrerequisites(pool) {
    logStep(1, 'Checking prerequisites');

    try {
        // Check PostgreSQL version
        const versionResult = await pool.query('SHOW server_version');
        const version = versionResult.rows[0].server_version;
        const majorVersion = parseInt(version.split('.')[0], 10);

        if (majorVersion < 12) {
            logError(`PostgreSQL ${majorVersion} detected. Minimum version 12 required.`);
            return false;
        }

        logSuccess(`PostgreSQL ${version} detected`);

        // Check if tables exist
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('forms', 'question_bank', 'submissions')
    `);

        if (tablesResult.rows.length !== 3) {
            logError('Required tables not found. Is this a CheckOps database?');
            return false;
        }

        logSuccess('All required tables found');

        // Check if already migrated
        const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'forms' AND column_name IN ('id', 'sid')
    `);

        const hasUuidId = columnsResult.rows.some(
            row => row.column_name === 'id' && row.data_type === 'uuid'
        );

        if (hasUuidId) {
            logWarning('Database appears to already be migrated to v4.0.0');
            const answer = await question('Do you want to continue anyway? (yes/no): ');
            if (answer.toLowerCase() !== 'yes') {
                return false;
            }
        }

        // Check for active connections
        const connectionsResult = await pool.query(`
      SELECT count(*) as count
      FROM pg_stat_activity
      WHERE datname = $1 AND pid != pg_backend_pid()
    `, [dbConfig.database]);

        const activeConnections = parseInt(connectionsResult.rows[0].count, 10);

        if (activeConnections > 0) {
            logWarning(`${activeConnections} active connection(s) detected`);
            logWarning('It is recommended to stop your application before migration');
            const answer = await question('Do you want to continue anyway? (yes/no): ');
            if (answer.toLowerCase() !== 'yes') {
                return false;
            }
        }

        logSuccess('Prerequisites check passed');
        return true;
    } catch (error) {
        logError(`Prerequisites check failed: ${error.message}`);
        return false;
    }
}

async function createBackup(pool) {
    logStep(2, 'Checking for backup');

    logWarning('IMPORTANT: You must create a database backup before proceeding!');
    log('\nBackup command:', 'bright');
    log(`  pg_dump -U ${dbConfig.user} -d ${dbConfig.database} > checkops_backup_v3_$(date +%Y%m%d_%H%M%S).sql\n`);

    const answer = await question('Have you created a backup? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
        logError('Migration aborted. Please create a backup first.');
        return false;
    }

    logSuccess('Backup confirmed');
    return true;
}

async function runMigration(pool, migrationFile, step, total) {
    logStep(step, `Running ${migrationFile}`);

    try {
        const migrationPath = join(__dirname, '..', 'migrations', migrationFile);
        const sql = readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        logSuccess(`${migrationFile} completed`);
        return true;
    } catch (error) {
        logError(`${migrationFile} failed: ${error.message}`);
        log('\nError details:', 'red');
        log(error.stack, 'red');
        return false;
    }
}

async function verifyMigration(pool) {
    logStep(9, 'Verifying migration');

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
    log('║         CheckOps v4.0.0 Migration Script                  ║', 'cyan');
    log('║         Dual-ID System Migration                          ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

    log('Database Configuration:', 'bright');
    log(`  Host: ${dbConfig.host}`);
    log(`  Port: ${dbConfig.port}`);
    log(`  Database: ${dbConfig.database}`);
    log(`  User: ${dbConfig.user}`);

    const answer = await question('\nIs this correct? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
        log('\nMigration aborted. Set environment variables:', 'yellow');
        log('  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD\n', 'yellow');
        rl.close();
        process.exit(0);
    }

    const pool = new Pool(dbConfig);

    try {
        // Test connection
        await pool.query('SELECT 1');
        logSuccess('Database connection established\n');

        // Run migration steps
        if (!await checkPrerequisites(pool)) {
            throw new Error('Prerequisites check failed');
        }

        if (!await createBackup(pool)) {
            throw new Error('Backup confirmation failed');
        }

        log('\n' + '='.repeat(60), 'bright');
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
            if (!await runMigration(pool, migrations[i], i + 3, 9)) {
                throw new Error(`Migration ${migrations[i]} failed`);
            }
        }

        // Verify migration
        if (!await verifyMigration(pool)) {
            throw new Error('Migration verification failed');
        }

        log('\n' + '='.repeat(60), 'green');
        log('Migration completed successfully!', 'green');
        log('='.repeat(60) + '\n', 'green');

        log('Next steps:', 'bright');
        log('  1. Update CheckOps package to v4.0.0');
        log('  2. Test your application thoroughly');
        log('  3. Monitor performance improvements');
        log('  4. Read UPGRADE_GUIDE_V4.md for code updates\n');

        rl.close();
        await pool.end();
        process.exit(0);
    } catch (error) {
        log('\n' + '='.repeat(60), 'red');
        log('Migration failed!', 'red');
        log('='.repeat(60) + '\n', 'red');

        logError(error.message);

        log('\nRollback options:', 'yellow');
        log('  1. Restore from backup (recommended):', 'yellow');
        log(`     psql -U ${dbConfig.user} -d ${dbConfig.database} < your_backup.sql\n`, 'yellow');
        log('  2. Run rollback script:', 'yellow');
        log('     psql -U ${dbConfig.user} -d ${dbConfig.database} -f migrations/rollback_v4.sql\n', 'yellow');

        rl.close();
        await pool.end();
        process.exit(1);
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    log('\n\nMigration interrupted by user', 'yellow');
    rl.close();
    process.exit(1);
});

main();
