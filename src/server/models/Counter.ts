import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface CounterRow {
  id: string;
  value: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export class CounterModel {
  private db = getDatabase();

  async createCounter(id: string, initialValue: number = 1): Promise<void> {
    const query = `
      INSERT INTO counters (id, value)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
    `;
    
    try {
      await this.db.query(query, [id, initialValue]);
      logger.debug(`Created counter: ${id} with initial value: ${initialValue}`);
    } catch (error) {
      logger.error(`Failed to create counter: ${id}`, error);
      throw error;
    }
  }

  async getNextValue(id: string): Promise<number> {
    const query = `
      UPDATE counters 
      SET value = value + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING value
    `;
    
    try {
      const result = await this.db.queryOne<{ value: bigint }>(query, [id]);
      
      if (!result) {
        throw new Error(`Counter with id '${id}' not found`);
      }
      
      const value = Number(result.value);
      logger.debug(`Incremented counter: ${id} to value: ${value}`);
      return value;
    } catch (error) {
      logger.error(`Failed to get next value for counter: ${id}`, error);
      throw error;
    }
  }

  async getCurrentValue(id: string): Promise<number | null> {
    const query = `
      SELECT value FROM counters WHERE id = $1
    `;
    
    try {
      const result = await this.db.queryOne<{ value: bigint }>(query, [id]);
      return result ? Number(result.value) : null;
    } catch (error) {
      logger.error(`Failed to get current value for counter: ${id}`, error);
      throw error;
    }
  }

  async resetCounter(id: string, newValue: number = 1): Promise<void> {
    const query = `
      UPDATE counters 
      SET value = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    try {
      const result = await this.db.query(query, [id, newValue]);
      
      if (result.length === 0) {
        throw new Error(`Counter with id '${id}' not found`);
      }
      
      logger.debug(`Reset counter: ${id} to value: ${newValue}`);
    } catch (error) {
      logger.error(`Failed to reset counter: ${id}`, error);
      throw error;
    }
  }

  async deleteCounter(id: string): Promise<void> {
    const query = `DELETE FROM counters WHERE id = $1`;
    
    try {
      const result = await this.db.query(query, [id]);
      
      if (result.length === 0) {
        throw new Error(`Counter with id '${id}' not found`);
      }
      
      logger.debug(`Deleted counter: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete counter: ${id}`, error);
      throw error;
    }
  }

  async listCounters(): Promise<CounterRow[]> {
    const query = `
      SELECT id, value, created_at, updated_at 
      FROM counters 
      ORDER BY id
    `;
    
    try {
      const rows = await this.db.query<CounterRow>(query);
      return rows;
    } catch (error) {
      logger.error('Failed to list counters', error);
      throw error;
    }
  }
}