import { execSync } from 'child_process';
import { logger } from '../../src/server/utils/logger.js';

export async function setup() {
  logger.info('Setting up integration test environment...');
  
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'checkops_test';
    process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
    process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || '';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
    
    // Run database migrations
    logger.info('Running database migrations for tests...');
    execSync('npm run migrate', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    logger.info('Integration test setup completed');
  } catch (error) {
    logger.error('Integration test setup failed', error);
    throw error;
  }
}

export async function teardown() {
  logger.info('Tearing down integration test environment...');
  // Add any cleanup logic here if needed
  logger.info('Integration test teardown completed');
}