/**
 * DB Readiness Preflight
 *
 * Used by integration and performance test suites to surface actionable
 * diagnostics when the database is not ready, instead of generic silent-skip
 * behavior or cryptic pool errors.
 *
 * Usage in a Jest beforeAll:
 *
 *   import { assertDbReady } from '../helpers/db-preflight.js';
 *
 *   beforeAll(async () => {
 *     await assertDbReady();      // throws with a clear message if not ready
 *     checkops = new CheckOps(...);
 *     await checkops.initialize();
 *   });
 */

import pg from 'pg';

const { Client } = pg;

// Required core tables — all five must exist for migrations to be complete.
const REQUIRED_TABLES = ['forms', 'question_bank', 'submissions', 'findings', 'sid_counters'];

/**
 * Build a pg connection config from env vars or explicit overrides.
 * @param {object} [config]
 * @returns {{ host: string, port: number, database: string, user: string, password: string }}
 */
function buildConfig(config = {}) {
    return {
        host: config.host || process.env.DB_HOST || 'localhost',
        port: parseInt(String(config.port || process.env.DB_PORT || '5432'), 10),
        database: config.database || process.env.DB_NAME || 'checkops',
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD || 'postgres',
        connectionTimeoutMillis: 3000,
    };
}

/**
 * Check whether the database is reachable, exists, and has the required schema.
 *
 * @param {object} [config] - Optional pg connection config overrides.
 * @returns {Promise<{ ready: boolean, reason: string | null }>}
 *   ready:  true if the database is fully usable for tests.
 *   reason: human-readable diagnosis string when ready is false, null otherwise.
 */
export async function checkDbReadiness(config = {}) {
    const dbConfig = buildConfig(config);
    const client = new Client(dbConfig);

    // ── Step 1: Can we connect at all? ──────────────────────────────────────
    try {
        await client.connect();
    } catch (error) {
        const code = error.code;

        if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
            return {
                ready: false,
                reason: `Database unreachable at ${dbConfig.host}:${dbConfig.port}. Is PostgreSQL running? Check DB_HOST and DB_PORT in your environment.`,
            };
        }
        if (code === '3D000') {
            // invalid_catalog_name — the database name itself does not exist
            return {
                ready: false,
                reason: `Database "${dbConfig.database}" does not exist. Create it first: createdb ${dbConfig.database}`,
            };
        }
        if (code === '28P01' || code === '28000') {
            // invalid_password / invalid_authorization_specification
            return {
                ready: false,
                reason: `Authentication failed for user "${dbConfig.user}" on database "${dbConfig.database}". Check DB_USER and DB_PASSWORD.`,
            };
        }

        return {
            ready: false,
            reason: `Cannot connect to database: ${error.message} (code: ${code || 'unknown'})`,
        };
    }

    // ── Step 2: Have migrations been applied? ─────────────────────────────
    try {
        const result = await client.query(
            `SELECT table_name
               FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name = ANY($1::text[])`,
            [REQUIRED_TABLES],
        );

        const found = result.rows.map((r) => r.table_name);
        const missing = REQUIRED_TABLES.filter((t) => !found.includes(t));

        if (missing.length > 0) {
            await client.end();
            return {
                ready: false,
                reason: `Migrations not applied — missing tables: ${missing.join(', ')}. Run: npm run migrate`,
            };
        }

        await client.end();
        return { ready: true, reason: null };
    } catch (error) {
        await client.end();
        return {
            ready: false,
            reason: `Schema check failed: ${error.message}. The database may need migrations: npm run migrate`,
        };
    }
}

/**
 * Assert DB readiness inside a Jest beforeAll.
 *
 * Throws a descriptive error that Jest surfaces as a setup failure — not a
 * silent skip or a cryptic pool error — so the developer immediately knows
 * what to fix.
 *
 * @param {object} [config] - Optional pg connection config overrides.
 * @throws {Error} If the database is not ready.
 */
export async function assertDbReady(config = {}) {
    const { ready, reason } = await checkDbReadiness(config);
    if (!ready) {
        throw new Error(`[db-preflight] ${reason}`);
    }
}
