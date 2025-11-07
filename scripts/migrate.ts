import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeDatabase, createDatabaseConfig } from '../src/server/config/database.js';
import { logger } from '../src/server/utils/logger.js';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    const db = initializeDatabase(createDatabaseConfig());
    
    // Test connection first
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Read and execute initial schema migration
    const migrationPath = join(process.cwd(), 'migrations', '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    logger.info('Executing initial schema migration...');
    await db.query(migrationSQL);
    
    logger.info('Database migrations completed successfully');
    
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };