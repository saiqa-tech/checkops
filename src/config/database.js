import pg from 'pg';
import { EventEmitter } from 'events';

const { Pool } = pg;

class DatabaseManager extends EventEmitter {
  constructor() {
    super();
    this.pool = null;
    this.isHealthy = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.healthCheckInterval = null;
    this.metrics = {
      totalQueries: 0,
      totalTime: 0,
      errors: 0,
      connectionErrors: 0,
    };
  }

  initializeDatabase(config) {
    if (this.pool) {
      throw new Error('Database already initialized. Call closeDatabase() first.');
    }

    const dbConfig = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || parseInt(process.env.DB_PORT || '5432', 10),
      database: config.database || process.env.DB_NAME || 'checkops',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD,
      ssl: config.ssl !== undefined ? config.ssl : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false),

      // Enhanced pool settings for better performance and reliability
      max: config.max || parseInt(process.env.DB_POOL_MAX || '25', 10),
      min: config.min || parseInt(process.env.DB_POOL_MIN || '5', 10),
      idleTimeoutMillis: config.idleTimeoutMillis || parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '20000', 10),
      connectionTimeoutMillis: config.connectionTimeoutMillis || parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
      statement_timeout: config.statementTimeout || parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      query_timeout: config.queryTimeout || parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),

      // Additional reliability settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

    this.pool = new Pool(dbConfig);
    this.setupPoolEventHandlers();
    this.startHealthCheck();

    return this.pool;
  }

  setupPoolEventHandlers() {
    this.pool.on('error', (err, client) => {
      this.isHealthy = false;
      this.metrics.errors++;
      this.metrics.connectionErrors++;
      this.emit('pool-error', err, client);
      console.error('Database pool error:', err);
      this.attemptReconnect();
    });

    this.pool.on('connect', (client) => {
      this.reconnectAttempts = 0;
      this.isHealthy = true;
      this.emit('pool-connect', client);

      // Set up client-level error handling
      client.on('error', (err) => {
        console.error('Database client error:', err);
        this.metrics.connectionErrors++;
      });
    });

    this.pool.on('acquire', (client) => {
      this.emit('pool-acquire', client);
    });

    this.pool.on('remove', (client) => {
      this.emit('pool-remove', client);
    });
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max-reconnect-attempts-reached');
      return;
    }

    this.reconnectAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Attempting database reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoff}ms`);

    setTimeout(async () => {
      try {
        await this.testConnection();
        this.isHealthy = true;
        this.reconnectAttempts = 0;
        console.log('Database reconnection successful');
        this.emit('reconnect-success');
      } catch (error) {
        console.error('Database reconnection failed:', error.message);
        this.attemptReconnect();
      }
    }, backoff);
  }

  startHealthCheck() {
    // Health check every minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.testConnection();
        if (!this.isHealthy) {
          this.isHealthy = true;
          this.emit('health-restored');
        }
      } catch (error) {
        if (this.isHealthy) {
          this.isHealthy = false;
          this.emit('health-degraded', error);
          console.warn('Database health check failed:', error.message);
        }
      }
    }, 60000);
  }

  getPool() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    if (!this.isHealthy) {
      console.warn('Database is unhealthy, but allowing operation to proceed');
    }
    return this.pool;
  }

  async testConnection() {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();
    try {
      const start = Date.now();
      await client.query('SELECT 1');
      const duration = Date.now() - start;

      // Update metrics
      this.metrics.totalQueries++;
      this.metrics.totalTime += duration;

      return true;
    } finally {
      client.release();
    }
  }

  getMetrics() {
    if (!this.pool) return null;

    return {
      // Pool metrics
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,

      // Health metrics
      isHealthy: this.isHealthy,
      reconnectAttempts: this.reconnectAttempts,

      // Performance metrics
      totalQueries: this.metrics.totalQueries,
      avgQueryTime: this.metrics.totalTime / this.metrics.totalQueries || 0,
      errors: this.metrics.errors,
      connectionErrors: this.metrics.connectionErrors,

      // Calculated metrics
      poolUtilization: this.pool.totalCount > 0 ?
        (this.pool.totalCount - this.pool.idleCount) / this.pool.totalCount : 0,
    };
  }

  async closeDatabase() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isHealthy = false;
      this.reconnectAttempts = 0;
    }
  }

  // Method to gracefully handle query execution with metrics
  async executeQuery(query, params = []) {
    const start = Date.now();
    const client = await this.getPool().connect();

    try {
      const result = await client.query(query, params);
      const duration = Date.now() - start;

      // Update metrics
      this.metrics.totalQueries++;
      this.metrics.totalTime += duration;

      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
const dbManager = new DatabaseManager();

export const initializeDatabase = dbManager.initializeDatabase.bind(dbManager);
export const getPool = dbManager.getPool.bind(dbManager);
export const closeDatabase = dbManager.closeDatabase.bind(dbManager);
export const testConnection = dbManager.testConnection.bind(dbManager);
export const getMetrics = dbManager.getMetrics.bind(dbManager);
export const executeQuery = dbManager.executeQuery.bind(dbManager);

// Export the manager instance for advanced usage
export { dbManager };
