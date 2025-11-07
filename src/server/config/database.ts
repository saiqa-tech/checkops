import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class Database {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', (client) => {
      logger.debug('New database client connected');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed');
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Executed query in ${duration}ms`, { query: text, params });
      return result.rows;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Query failed after ${duration}ms`, { query: text, params, error });
      throw error;
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  getPool(): Pool {
    return this.pool;
  }
}

let databaseInstance: Database | null = null;

export const initializeDatabase = (config: DatabaseConfig): Database => {
  if (databaseInstance) {
    return databaseInstance;
  }
  
  databaseInstance = new Database(config);
  return databaseInstance;
};

export const getDatabase = (): Database => {
  if (!databaseInstance) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return databaseInstance;
};

export const createDatabaseConfig = (): DatabaseConfig => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'checkops',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  };
};