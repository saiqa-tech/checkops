import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { CounterModel } from './Counter.js';
import bcrypt from 'bcryptjs';

export interface ApiKeyRow {
  id: string;
  keyHash: string;
  name: string;
  description?: string;
  permissions: string[];
  rateLimitPerHour: number;
  isActive: boolean;
  lastUsedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyCreateRequest {
  name: string;
  description?: string;
  permissions: string[];
  rateLimitPerHour?: number;
  createdBy?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  rateLimitPerHour: number;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  // Note: keyHash is never returned
}

export class ApiKeyModel {
  private db = getDatabase();
  private counterModel = new CounterModel();

  async createApiKey(request: ApiKeyCreateRequest): Promise<{ apiKey: string; details: ApiKeyResponse }> {
    const query = `
      INSERT INTO api_keys (key_hash, name, description, permissions, rate_limit_per_hour, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      // Generate a unique API key
      const keyId = await this.counterModel.getNextValue('api_keys');
      const apiKey = `ck_${keyId}_${this.generateRandomString(32)}`;
      const keyHash = await bcrypt.hash(apiKey, 12);

      const result = await this.db.queryOne<ApiKeyRow>(query, [
        keyHash,
        request.name,
        request.description,
        JSON.stringify(request.permissions),
        request.rateLimitPerHour || 1000,
        request.createdBy
      ]);

      if (!result) {
        throw new Error('Failed to create API key');
      }

      const response: ApiKeyResponse = {
        id: result.id,
        name: result.name,
        description: result.description,
        permissions: result.permissions,
        rateLimitPerHour: result.rateLimitPerHour,
        isActive: result.isActive,
        lastUsedAt: result.lastUsedAt,
        createdAt: result.createdAt
      };

      logger.info(`Created API key: ${result.id} with name: ${request.name}`);
      
      // Return the actual API key (this is the only time it's shown)
      return { apiKey, details: response };
    } catch (error) {
      logger.error('Failed to create API key', error);
      throw error;
    }
  }

  async validateApiKey(apiKey: string): Promise<ApiKeyRow | null> {
    const query = `
      SELECT * FROM api_keys WHERE is_active = true
    `;

    try {
      const apiKeys = await this.db.query<ApiKeyRow>(query);
      
      for (const keyRecord of apiKeys) {
        const isValid = await bcrypt.compare(apiKey, keyRecord.keyHash);
        if (isValid) {
          // Update last used timestamp
          await this.updateLastUsed(keyRecord.id);
          return keyRecord;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to validate API key', error);
      throw error;
    }
  }

  async getApiKey(id: string): Promise<ApiKeyResponse | null> {
    const query = `
      SELECT id, name, description, permissions, rate_limit_per_hour, 
             is_active, last_used_at, created_at, updated_at
      FROM api_keys WHERE id = $1
    `;

    try {
      const result = await this.db.queryOne<Omit<ApiKeyRow, 'keyHash'>>(query, [id]);
      
      if (!result) {
        return null;
      }

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        permissions: result.permissions,
        rateLimitPerHour: result.rateLimitPerHour,
        isActive: result.isActive,
        lastUsedAt: result.lastUsedAt,
        createdAt: result.createdAt
      };
    } catch (error) {
      logger.error(`Failed to get API key: ${id}`, error);
      throw error;
    }
  }

  async listApiKeys(includeInactive: boolean = false): Promise<ApiKeyResponse[]> {
    let query = `
      SELECT id, name, description, permissions, rate_limit_per_hour, 
             is_active, last_used_at, created_at, updated_at
      FROM api_keys
    `;
    
    const params = [];
    if (!includeInactive) {
      query += ` WHERE is_active = true`;
    }
    
    query += ` ORDER BY created_at DESC`;

    try {
      const results = await this.db.query<Omit<ApiKeyRow, 'keyHash'>>(query, params);
      
      return results.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: row.permissions,
        rateLimitPerHour: row.rateLimitPerHour,
        isActive: row.isActive,
        lastUsedAt: row.lastUsedAt,
        createdAt: row.createdAt
      }));
    } catch (error) {
      logger.error('Failed to list API keys', error);
      throw error;
    }
  }

  async updateApiKey(
    id: string,
    updates: Partial<Pick<ApiKeyRow, 'name' | 'description' | 'permissions' | 'rateLimitPerHour' | 'isActive'>>,
    updatedBy?: string
  ): Promise<ApiKeyResponse> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'permissions') {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE api_keys 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, permissions, rate_limit_per_hour, 
             is_active, last_used_at, created_at, updated_at
    `;

    try {
      const result = await this.db.queryOne<Omit<ApiKeyRow, 'keyHash'>>(query, values);
      
      if (!result) {
        throw new Error(`API key with id '${id}' not found`);
      }

      const response: ApiKeyResponse = {
        id: result.id,
        name: result.name,
        description: result.description,
        permissions: result.permissions,
        rateLimitPerHour: result.rateLimitPerHour,
        isActive: result.isActive,
        lastUsedAt: result.lastUsedAt,
        createdAt: result.createdAt
      };

      logger.info(`Updated API key: ${id}`);
      return response;
    } catch (error) {
      logger.error(`Failed to update API key: ${id}`, error);
      throw error;
    }
  }

  async revokeApiKey(id: string): Promise<void> {
    const query = `
      UPDATE api_keys 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.length === 0) {
        throw new Error(`API key with id '${id}' not found`);
      }

      logger.info(`Revoked API key: ${id}`);
    } catch (error) {
      logger.error(`Failed to revoke API key: ${id}`, error);
      throw error;
    }
  }

  async deleteApiKey(id: string): Promise<void> {
    const query = `DELETE FROM api_keys WHERE id = $1`;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.length === 0) {
        throw new Error(`API key with id '${id}' not found`);
      }

      logger.info(`Deleted API key: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete API key: ${id}`, error);
      throw error;
    }
  }

  async regenerateApiKey(id: string): Promise<string> {
    const selectQuery = `SELECT name, description, permissions, rate_limit_per_hour FROM api_keys WHERE id = $1`;
    const updateQuery = `
      UPDATE api_keys 
      SET key_hash = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;

    try {
      const currentKey = await this.db.queryOne<Omit<ApiKeyRow, 'keyHash' | 'isActive' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>>(selectQuery, [id]);
      
      if (!currentKey) {
        throw new Error(`API key with id '${id}' not found`);
      }

      // Generate new API key
      const keyId = await this.counterModel.getNextValue('api_keys');
      const newApiKey = `ck_${keyId}_${this.generateRandomString(32)}`;
      const keyHash = await bcrypt.hash(newApiKey, 12);

      await this.db.queryOne(updateQuery, [id, keyHash]);

      logger.info(`Regenerated API key: ${id}`);
      return newApiKey;
    } catch (error) {
      logger.error(`Failed to regenerate API key: ${id}`, error);
      throw error;
    }
  }

  private async updateLastUsed(id: string): Promise<void> {
    const query = `
      UPDATE api_keys 
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await this.db.query(query, [id]);
    } catch (error) {
      logger.error(`Failed to update last used timestamp for API key: ${id}`, error);
      // Don't throw here as this is not critical
    }
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  hasPermission(apiKey: ApiKeyRow, permission: string): boolean {
    return apiKey.permissions.includes('*') || apiKey.permissions.includes(permission);
  }
}