// Main entry point for @saiqa-tech/checkops npm package

// Services
export { FormService } from './services/FormService.js';
export { QuestionService } from './services/QuestionService.js';
export { SubmissionService } from './services/SubmissionService.js';
export { SubmissionHistoryService } from './services/SubmissionHistoryService.js';
export { ValidationService } from './services/ValidationService.js';
export { SecurityService } from './services/SecurityService.js';
export { IdGenerator } from './services/IdGenerator.js';

// Types
export type * from './types/index.js';

// Utilities
export * from './utils/index.js';

// Database connection helper
export { createPool } from './config/database.js';

// Default configuration
export const defaultConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'checkops',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000')
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    bcryptRounds: 12,
    defaultRateLimitPerHour: 1000
  }
};

export type CheckOpsConfig = typeof defaultConfig;