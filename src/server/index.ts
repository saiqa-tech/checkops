import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { CheckOpsServer } from './app.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Log startup information
logger.info('Starting CheckOps Form Builder Server...', {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  dbHost: process.env.DB_HOST,
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME
});

// Create and start the server
const server = new CheckOpsServer();

server.start(parseInt(process.env.PORT || '3000'))
  .then(() => {
    logger.info('Server startup completed successfully');
  })
  .catch((error) => {
    logger.error('Server startup failed', error);
    process.exit(1);
  });

export { CheckOpsServer };