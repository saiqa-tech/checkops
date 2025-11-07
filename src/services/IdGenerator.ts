import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface Counter {
  id: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export class IdGenerator {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getNextId(counterName: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current counter value
      const selectQuery = 'SELECT value FROM counters WHERE id = $1 FOR UPDATE';
      const selectResult = await client.query(selectQuery, [counterName]);
      
      if (selectResult.rows.length === 0) {
        // Create counter if it doesn't exist
        const insertQuery = `
          INSERT INTO counters (id, value, created_at, updated_at)
          VALUES ($1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING value
        `;
        await client.query(insertQuery, [counterName]);
      }

      // Increment counter
      const updateQuery = `
        UPDATE counters 
        SET value = value + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING value
      `;
      const updateResult = await client.query(updateQuery, [counterName]);

      await client.query('COMMIT');

      const newValue = updateResult.rows[0].value;
      const formattedId = this.formatId(counterName, newValue);

      logger.debug('Generated new ID', { 
        counterName, 
        newValue, 
        formattedId 
      });

      return formattedId;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to generate ID', { counterName, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentValue(counterName: string): Promise<number | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT value FROM counters WHERE id = $1';
      const result = await client.query(query, [counterName]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].value;
    } finally {
      client.release();
    }
  }

  async resetCounter(counterName: string, initialValue: number = 1): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO counters (id, value, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET 
          value = $2, 
          updated_at = CURRENT_TIMESTAMP
      `;
      await client.query(query, [counterName, initialValue]);

      logger.info('Counter reset successfully', { counterName, initialValue });
    } finally {
      client.release();
    }
  }

  async createCounter(counterName: string, initialValue: number = 1): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO counters (id, value, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `;
      await client.query(query, [counterName, initialValue]);

      logger.debug('Counter created', { counterName, initialValue });
    } finally {
      client.release();
    }
  }

  async getAllCounters(): Promise<Counter[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, value, created_at, updated_at 
        FROM counters 
        ORDER BY id
      `;
      const result = await client.query(query);
      
      return result.rows.map(row => this.mapRowToCounter(row));
    } finally {
      client.release();
    }
  }

  private formatId(counterName: string, value: number): string {
    // Format: counterName_value (e.g., forms_123, submissions_456)
    return `${counterName}_${value}`;
  }

  private mapRowToCounter(row: any): Counter {
    return {
      id: row.id,
      value: row.value,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}