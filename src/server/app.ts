import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabase, createDatabaseConfig } from './config/database.js';
import { logger } from './utils/logger.js';
import { 
  requestIdHandler, 
  errorHandler, 
  notFoundHandler, 
  healthCheck 
} from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { 
  apiRateLimit, 
  authRateLimit, 
  submissionRateLimit 
} from './middleware/rateLimit.js';

// Import controllers
import * as formsController from './controllers/formsController.js';
import * as submissionsController from './controllers/submissionsController.js';
import * as apiKeysController from './controllers/apiKeysController.js';

export class CheckOpsServer {
  private app: express.Application;
  private isInitialized = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      credentials: false,
      maxAge: 86400 // 24 hours
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID and logging
    this.app.use(requestIdHandler);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.headers['x-request-id']
        });
      });

      next();
    });

    // Global rate limiting
    this.app.use(apiRateLimit);
  }

  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', healthCheck);
    this.app.get('/api/v1/health', healthCheck);

    // API documentation endpoint
    this.app.get('/api/v1/docs', (req, res) => {
      res.json({
        name: 'CheckOps Form Builder API',
        version: '2.0.0',
        description: 'API for managing forms and submissions with full backend support',
        endpoints: {
          health: 'GET /health',
          forms: {
            list: 'GET /api/v1/forms',
            create: 'POST /api/v1/forms',
            get: 'GET /api/v1/forms/:id',
            update: 'PUT /api/v1/forms/:id',
            updateSchema: 'PUT /api/v1/forms/:id/schema',
            delete: 'DELETE /api/v1/forms/:id',
            search: 'GET /api/v1/forms/search',
            versions: 'GET /api/v1/forms/:id/versions',
            version: 'GET /api/v1/forms/:id/versions/:version'
          },
          submissions: {
            create: 'POST /api/v1/forms/:formId/submissions',
            list: 'GET /api/v1/submissions',
            get: 'GET /api/v1/submissions/:id',
            getBySubmissionId: 'GET /api/v1/submissions/by-id/:submissionId',
            updateStatus: 'PUT /api/v1/submissions/:id/status',
            delete: 'DELETE /api/v1/submissions/:id',
            search: 'GET /api/v1/submissions/search',
            stats: 'GET /api/v1/submissions/stats',
            recent: 'GET /api/v1/forms/:formId/submissions/recent'
          },
          apiKeys: {
            list: 'GET /api/v1/api-keys',
            create: 'POST /api/v1/api-keys',
            get: 'GET /api/v1/api-keys/:id',
            update: 'PUT /api/v1/api-keys/:id',
            revoke: 'POST /api/v1/api-keys/:id/revoke',
            regenerate: 'POST /api/v1/api-keys/:id/regenerate',
            delete: 'DELETE /api/v1/api-keys/:id'
          }
        },
        authentication: 'Bearer Token (API Key)',
        rateLimiting: 'Configurable per API key and endpoint',
        documentation: 'https://docs.checkops.dev/form-builder'
      });
    });

    // API v1 routes
    const apiRouter = express.Router();

    // Forms routes
    apiRouter.get('/forms', authMiddleware.authenticate, authMiddleware.requirePermission('forms:read'), formsController.listForms);
    apiRouter.post('/forms', authMiddleware.authenticate, authMiddleware.requirePermission('forms:create'), formsController.createForm);
    apiRouter.get('/forms/search', authMiddleware.authenticate, authMiddleware.requirePermission('forms:read'), formsController.searchForms);
    apiRouter.get('/forms/:id', authMiddleware.authenticate, authMiddleware.requirePermission('forms:read'), formsController.getForm);
    apiRouter.put('/forms/:id', authMiddleware.authenticate, authMiddleware.requirePermission('forms:update'), formsController.updateForm);
    apiRouter.put('/forms/:id/schema', authMiddleware.authenticate, authMiddleware.requirePermission('forms:update'), formsController.updateFormSchema);
    apiRouter.delete('/forms/:id', authMiddleware.authenticate, authMiddleware.requirePermission('forms:delete'), formsController.deleteForm);
    apiRouter.get('/forms/:id/versions', authMiddleware.authenticate, authMiddleware.requirePermission('forms:read'), formsController.getFormVersions);
    apiRouter.get('/forms/:id/versions/:version', authMiddleware.authenticate, authMiddleware.requirePermission('forms:read'), formsController.getFormVersion);

    // Submissions routes
    apiRouter.post('/forms/:formId/submissions', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:create'), submissionRateLimit, submissionsController.createSubmission);
    apiRouter.get('/submissions', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.listSubmissions);
    apiRouter.get('/submissions/search', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.searchSubmissions);
    apiRouter.get('/submissions/stats', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.getSubmissionStats);
    apiRouter.get('/submissions/:id', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.getSubmission);
    apiRouter.get('/submissions/by-id/:submissionId', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.getSubmissionBySubmissionId);
    apiRouter.put('/submissions/:id/status', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:update'), submissionsController.updateSubmissionStatus);
    apiRouter.delete('/submissions/:id', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:delete'), submissionsController.deleteSubmission);
    apiRouter.get('/forms/:formId/submissions/recent', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:read'), submissionsController.getRecentSubmissions);

    // API Keys routes (with stricter rate limiting)
    apiRouter.post('/api-keys', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:create'), authRateLimit, apiKeysController.createApiKey);
    apiRouter.get('/api-keys', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:read'), authRateLimit, apiKeysController.listApiKeys);
    apiRouter.get('/api-keys/:id', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:read'), authRateLimit, apiKeysController.getApiKey);
    apiRouter.put('/api-keys/:id', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:update'), authRateLimit, apiKeysController.updateApiKey);
    apiRouter.post('/api-keys/:id/revoke', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:update'), authRateLimit, apiKeysController.revokeApiKey);
    apiRouter.post('/api-keys/:id/regenerate', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:update'), authRateLimit, apiKeysController.regenerateApiKey);
    apiRouter.delete('/api-keys/:id', authMiddleware.authenticate, authMiddleware.requirePermission('api-keys:delete'), authRateLimit, apiKeysController.deleteApiKey);

    this.app.use('/api/v1', apiRouter);

    // Legacy compatibility routes (for existing SDK)
    const legacyRouter = express.Router();
    
    // Form submission endpoint for existing SDK
    legacyRouter.post('/forms/:formId/submissions', authMiddleware.authenticate, authMiddleware.requirePermission('submissions:create'), submissionRateLimit, submissionsController.createSubmission);
    
    this.app.use('/', legacyRouter);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing CheckOps Form Builder Server...');

      // Initialize database
      const db = initializeDatabase(createDatabaseConfig());
      const isConnected = await db.testConnection();
      
      if (!isConnected) {
        throw new Error('Failed to connect to database');
      }

      logger.info('Database connection established');

      // Initialize counters
      const { CounterModel } = await import('./models/Counter.js');
      const counterModel = new CounterModel();
      
      // Ensure essential counters exist
      await counterModel.createCounter('forms', 1);
      await counterModel.createCounter('api_keys', 1);

      logger.info('Server initialization completed');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Server initialization failed', error);
      throw error;
    }
  }

  getApp(): express.Application {
    return this.app;
  }

  async start(port: number = parseInt(process.env.PORT || '3000')): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, () => {
        logger.info(`CheckOps Form Builder Server started on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`API documentation: http://localhost:${port}/api/v1/docs`);
        resolve();
      });

      server.on('error', (error) => {
        logger.error('Failed to start server', error);
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });
    });
  }
}