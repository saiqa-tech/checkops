import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export interface ApiKey {
  id: string;
  keyHash: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  rateLimitPerHour: number;
  lastUsedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  rateLimitPerHour?: number;
  createdBy: string;
}

export interface AuthenticateRequest {
  apiKey: string;
}

export interface AuthenticateResult {
  isValid: boolean;
  apiKey?: ApiKey;
  errorMessage?: string;
}

export interface PermissionCheck {
  hasPermission: boolean;
  apiKey?: ApiKey;
  errorMessage?: string;
}

export class SecurityService {
  private pool: Pool;
  private readonly jwtSecret: string;

  constructor(pool: Pool, jwtSecret?: string) {
    this.pool = pool;
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'default-secret-change-in-production';
  }

  async createApiKey(request: CreateApiKeyRequest): Promise<{ apiKey: string; apiKeyData: ApiKey }> {
    const client = await this.pool.connect();
    try {
      // Generate API key
      const apiKey = this.generateApiKey();
      const saltRounds = 12;
      const keyHash = await bcrypt.hash(apiKey, saltRounds);

      const query = `
        INSERT INTO api_keys (
          key_hash, name, permissions, rate_limit_per_hour, is_active, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        keyHash,
        request.name,
        JSON.stringify(request.permissions),
        request.rateLimitPerHour || 1000,
        request.createdBy
      ]);

      const apiKeyData = this.mapRowToApiKey(result.rows[0]);

      logger.info('API key created successfully', { 
        apiKeyId: apiKeyData.id, 
        name: request.name,
        createdBy: request.createdBy 
      });

      // Return the API key only once during creation
      return { apiKey, apiKeyData };
    } finally {
      client.release();
    }
  }

  async authenticate(request: AuthenticateRequest): Promise<AuthenticateResult> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM api_keys 
        WHERE is_active = true
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);

      // Check each API key hash
      for (const row of result.rows) {
        const isValid = await bcrypt.compare(request.apiKey, row.key_hash);
        if (isValid) {
          // Update last used timestamp
          await this.updateLastUsed(row.id);
          
          const apiKey = this.mapRowToApiKey(row);
          logger.debug('API key authenticated successfully', { 
            apiKeyId: apiKey.id, 
            name: apiKey.name 
          });

          return { isValid: true, apiKey };
        }
      }

      logger.warn('API key authentication failed', { 
        providedKey: request.apiKey.substring(0, 8) + '...' 
      });

      return { isValid: false, errorMessage: 'Invalid API key' };
    } finally {
      client.release();
    }
  }

  async getApiKeyById(id: string): Promise<ApiKey | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM api_keys WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToApiKey(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getAllApiKeys(limit: number = 50, offset: number = 0): Promise<ApiKey[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM api_keys 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToApiKey(row));
    } finally {
      client.release();
    }
  }

  async updateApiKey(
    id: string, 
    updates: Partial<Omit<ApiKey, 'id' | 'keyHash' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<ApiKey | null> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          const fieldName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${fieldName} = $${paramIndex}`);
          
          if (key === 'permissions') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE api_keys 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const apiKey = this.mapRowToApiKey(result.rows[0]);
      
      logger.info('API key updated successfully', { 
        apiKeyId: apiKey.id, 
        name: apiKey.name 
      });

      return apiKey;
    } finally {
      client.release();
    }
  }

  async deactivateApiKey(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE api_keys 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      const result = await client.query(query, [id]);
      
      const deactivated = result.rowCount > 0;
      if (deactivated) {
        logger.info('API key deactivated', { apiKeyId: id });
      }
      
      return deactivated;
    } finally {
      client.release();
    }
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM api_keys WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('API key deleted', { apiKeyId: id });
      }
      
      return deleted;
    } finally {
      client.release();
    }
  }

  async checkPermission(apiKey: ApiKey, permission: string): Promise<PermissionCheck> {
    // Check if API key has the required permission
    const hasPermission = apiKey.permissions.includes('*') || apiKey.permissions.includes(permission);
    
    if (!hasPermission) {
      logger.warn('Permission check failed', {
        apiKeyId: apiKey.id,
        requiredPermission: permission,
        apiKeyPermissions: apiKey.permissions
      });

      return {
        hasPermission: false,
        apiKey,
        errorMessage: `Insufficient permissions. Required: ${permission}`
      };
    }

    return {
      hasPermission: true,
      apiKey
    };
  }

  async generateJwtToken(payload: any, expiresIn: string = '1h'): Promise<string> {
    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  async verifyJwtToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.warn('JWT verification failed', error);
      return null;
    }
  }

  private generateApiKey(): string {
    const prefix = 'ck_';
    const randomBytes = require('crypto').randomBytes(32);
    const apiKey = prefix + randomBytes.toString('hex');
    return apiKey;
  }

  private async updateLastUsed(apiKeyId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE api_keys 
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await client.query(query, [apiKeyKeyId]);
    } finally {
      client.release();
    }
  }

  private mapRowToApiKey(row: any): ApiKey {
    return {
      id: row.id,
      keyHash: row.key_hash,
      name: row.name,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      isActive: row.is_active,
      rateLimitPerHour: row.rate_limit_per_hour,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}