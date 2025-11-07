import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { SecurityService } from '../src/services/SecurityService.js';
import { createPool, defaultDatabaseConfig } from '../src/config/database.js';

describe('SecurityService', () => {
  let pool: Pool;
  let securityService: SecurityService;

  beforeAll(async () => {
    pool = createPool({
      ...defaultDatabaseConfig,
      database: 'checkops_test'
    });
    
    securityService = new SecurityService(pool, 'test-secret');
    
    // Create api_keys table for testing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        permissions JSONB NOT NULL,
        rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create an API key successfully', async () => {
    const createRequest = {
      name: 'Test API Key',
      permissions: ['forms:read', 'submissions:create'],
      rateLimitPerHour: 500,
      createdBy: 'test-user'
    };

    const result = await securityService.createApiKey(createRequest);

    expect(result).toBeDefined();
    expect(result.apiKey).toBeDefined();
    expect(result.apiKeyData).toBeDefined();
    expect(result.apiKeyData.name).toBe(createRequest.name);
    expect(result.apiKeyData.permissions).toEqual(createRequest.permissions);
    expect(result.apiKeyData.isActive).toBe(true);
    expect(result.apiKey).toMatchObject({
      id: expect.any(String),
      name: createRequest.name,
      permissions: createRequest.permissions,
      isActive: true,
      rateLimitPerHour: createRequest.rateLimitPerHour,
      createdBy: createRequest.createdBy,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('should authenticate with valid API key', async () => {
    // Create an API key first
    const createRequest = {
      name: 'Auth Test Key',
      permissions: ['*'],
      createdBy: 'test-user'
    };
    const { apiKey: createdApiKey } = await securityService.createApiKey(createRequest);

    // Try to authenticate with it
    const authRequest = { apiKey: createdApiKey };
    const authResult = await securityService.authenticate(authRequest);

    expect(authResult.isValid).toBe(true);
    expect(authResult.apiKey).toBeDefined();
    expect(authResult.apiKey?.id).toBe(createdApiKey);
  });

  it('should reject invalid API key', async () => {
    const authRequest = { apiKey: 'invalid-key-12345' };
    const authResult = await securityService.authenticate(authRequest);

    expect(authResult.isValid).toBe(false);
    expect(authResult.apiKey).toBeUndefined();
    expect(authResult.errorMessage).toBe('Invalid API key');
  });

  it('should check permissions correctly', async () => {
    // Create API key with limited permissions
    const createRequest = {
      name: 'Limited Key',
      permissions: ['forms:read'],
      createdBy: 'test-user'
    };
    const { apiKey: createdApiKey } = await securityService.createApiKey(createRequest);

    // Authenticate to get the API key object
    const authRequest = { apiKey: createdApiKey };
    const authResult = await securityService.authenticate(authRequest);

    expect(authResult.isValid).toBe(true);

    // Check permission that should pass
    const validPermissionCheck = await securityService.checkPermission(
      authResult.apiKey!,
      'forms:read'
    );

    expect(validPermissionCheck.hasPermission).toBe(true);
    expect(validPermissionCheck.errorMessage).toBeUndefined();

    // Check permission that should fail
    const invalidPermissionCheck = await securityService.checkPermission(
      authResult.apiKey!,
      'forms:delete'
    );

    expect(invalidPermissionCheck.hasPermission).toBe(false);
    expect(invalidPermissionCheck.errorMessage).toContain('Insufficient permissions');
  });

  it('should update API key', async () => {
    // Create an API key first
    const createRequest = {
      name: 'Update Test Key',
      permissions: ['forms:read'],
      createdBy: 'test-user'
    };
    const { apiKeyData } = await securityService.createApiKey(createRequest);

    // Update it
    const updates = {
      name: 'Updated Key Name',
      permissions: ['forms:read', 'submissions:create'],
      rateLimitPerHour: 2000
    };
    const updatedApiKey = await securityService.updateApiKey(apiKeyData.id, updates);

    expect(updatedApiKey).toBeDefined();
    expect(updatedApiKey?.name).toBe(updates.name);
    expect(updatedApiKey?.permissions).toEqual(updates.permissions);
    expect(updatedApiKey?.rateLimitPerHour).toBe(updates.rateLimitPerHour);
  });

  it('should deactivate API key', async () => {
    // Create an API key first
    const createRequest = {
      name: 'Deactivate Test Key',
      permissions: ['forms:read'],
      createdBy: 'test-user'
    };
    const { apiKeyData } = await securityService.createApiKey(createRequest);

    // Deactivate it
    const deactivated = await securityService.deactivateApiKey(apiKeyData.id);

    expect(deactivated).toBe(true);
  });

  it('should delete API key', async () => {
    // Create an API key first
    const createRequest = {
      name: 'Delete Test Key',
      permissions: ['forms:read'],
      createdBy: 'test-user'
    };
    const { apiKeyData } = await securityService.createApiKey(createRequest);

    // Delete it
    const deleted = await securityService.deleteApiKey(apiKeyData.id);

    expect(deleted).toBe(true);
  });

  it('should generate and verify JWT tokens', async () => {
    const payload = { userId: 'test-user', permissions: ['forms:read'] };
    const token = await securityService.generateJwtToken(payload, '1h');

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Verify the token
    const verifiedPayload = await securityService.verifyJwtToken(token);

    expect(verifiedPayload).toBeDefined();
    expect(verifiedPayload.userId).toBe(payload.userId);
    expect(verifiedPayload.permissions).toEqual(payload.permissions);
  });

  it('should reject invalid JWT token', async () => {
    const invalidToken = 'invalid.jwt.token';
    const verifiedPayload = await securityService.verifyJwtToken(invalidToken);

    expect(verifiedPayload).toBeNull();
  });
});