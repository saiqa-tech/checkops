import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function initializeDatabase(config) {
  if (pool) {
    throw new Error('Database already initialized. Call closeDatabase() first.');
  }

  const dbConfig = {
    host: config.host || process.env.DB_HOST || 'localhost',
    port: config.port || parseInt(process.env.DB_PORT || '5432', 10),
    database: config.database || process.env.DB_NAME || 'checkops',
    user: config.user || process.env.DB_USER || 'postgres',
    password: config.password || process.env.DB_PASSWORD,
    ssl: config.ssl !== undefined ? config.ssl : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false),
    max: config.max || parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: config.min || parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: config.idleTimeoutMillis || parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  };

  pool = new Pool(dbConfig);

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function testConnection() {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}
