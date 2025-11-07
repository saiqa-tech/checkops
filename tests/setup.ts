import { Pool } from 'pg';
import { createPool, defaultDatabaseConfig } from '../src/config/database.js';

let testPool: Pool;

beforeAll(async () => {
  // Create test database connection
  testPool = createPool({
    ...defaultDatabaseConfig,
    database: 'checkops_test'
  });

  // Create test tables
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS forms (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(500) NOT NULL,
      description TEXT,
      schema JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      submitted_by VARCHAR(255),
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP WITH TIME ZONE,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      permissions JSONB NOT NULL,
      rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_used_at TIMESTAMP WITH TIME ZONE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

afterAll(async () => {
  // Clean up test database
  if (testPool) {
    await testPool.query(`
      DROP TABLE IF EXISTS submissions CASCADE;
      DROP TABLE IF EXISTS forms CASCADE;
      DROP TABLE IF EXISTS api_keys CASCADE;
    `);
    await testPool.end();
  }
});

export { testPool };