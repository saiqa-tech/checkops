import pg from 'pg';

const { Pool } = pg;

async function test() {
    const pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'checkops',
        user: 'postgres',
        password: 'postgres'
    });

    try {
        console.log('Testing SQL query...');

        const tableName = 'question_bank';
        const prefix = 'Q';

        const result = await pool.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM '${prefix}-(\\d+)') AS INTEGER)), 0) + 1 AS next_counter
         FROM ${tableName}
         WHERE sid ~ '^${prefix}-[0-9]+$'`
        );

        console.log('Result:', result.rows[0]);
        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

test();
