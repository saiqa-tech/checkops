import express from 'express';
import request from 'supertest';
import {
  createCheckOpsMiddleware,
  createFormEndpoint,
  createSubmissionEndpoint,
  getFormEndpoint,
  getSubmissionsEndpoint,
  getStatsEndpoint,
  healthCheckEndpoint,
  metricsEndpoint,
  checkOpsErrorHandler,
} from '../../checkops-power/lib/express-middleware.js';

describe('Express Middleware - Endpoint Tests', () => {
  describe('Middleware Attachment', () => {
    test('should attach checkops to request after initialization', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        initialize: async () => { },
      };

      // Mock the CheckOpsWrapper
      app.use(async (req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });

      app.get('/test', (req, res) => {
        res.json({ hasCheckops: !!req.checkops });
      });

      const response = await request(app).get('/test');
      expect(response.body.hasCheckops).toBe(true);
    });

    test('should return 503 on initialization failure', async () => {
      const app = express();
      app.use(express.json());

      app.use(async (req, res, next) => {
        // Simulate initialization failure
        res.status(503).json({
          error: 'CheckOps service unavailable',
          message: 'Connection failed',
        });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(503);
      expect(response.body.error).toContain('unavailable');
    });
  });

  describe('Form Endpoint', () => {
    test('should create form and return 201 status', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createForm: async (data) => ({
          id: 'form_123',
          ...data,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms', createFormEndpoint());

      const response = await request(app)
        .post('/forms')
        .send({
          title: 'Test Form',
          questions: [
            {
              questionText: 'Test Question',
              questionType: 'text',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('form_123');
    });

    test('should return error for invalid form data', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createForm: async () => {
          throw new Error('Form title is required');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms', createFormEndpoint());

      const response = await request(app).post('/forms').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should handle form with multiple questions', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createForm: async (data) => ({
          id: 'form_456',
          ...data,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms', createFormEndpoint());

      const response = await request(app)
        .post('/forms')
        .send({
          title: 'Multi-Question Form',
          questions: [
            { questionText: 'Q1', questionType: 'text' },
            { questionText: 'Q2', questionType: 'select', options: [] },
            { questionText: 'Q3', questionType: 'rating' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.questions).toHaveLength(3);
    });
  });

  describe('Submission Endpoint', () => {
    test('should create submission and return 201 status', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createSubmission: async ({ formId, submissionData }) => ({
          id: 'sub_123',
          formId,
          data: submissionData,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms/:formId/submissions', createSubmissionEndpoint());

      const response = await request(app)
        .post('/forms/form_123/submissions')
        .send({ question1: 'answer1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('sub_123');
    });

    test('should return 404 when form ID is missing from route', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createSubmission: async () => { },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms/:formId/submissions', createSubmissionEndpoint());

      const response = await request(app)
        .post('/forms//submissions')
        .send({ question1: 'answer1' });

      expect(response.status).toBe(404);
    });

    test('should return error for invalid submission data', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        createSubmission: async () => {
          throw new Error('Invalid submission data');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.post('/forms/:formId/submissions', createSubmissionEndpoint());

      const response = await request(app)
        .post('/forms/form_123/submissions')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Form Endpoint', () => {
    test('should retrieve form by ID', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getForm: async (id) => ({
          id,
          title: 'Retrieved Form',
          questions: [],
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:id', getFormEndpoint());

      const response = await request(app).get('/forms/form_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Retrieved Form');
    });

    test('should return 404 for non-existent form', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getForm: async () => {
          throw new Error('Form not found');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:id', getFormEndpoint());

      const response = await request(app).get('/forms/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    test('should support cache parameter', async () => {
      const app = express();
      app.use(express.json());

      let cacheUsed = true;
      const mockCheckOps = {
        getForm: async (id, useCache) => {
          cacheUsed = useCache;
          return { id, title: 'Form' };
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:id', getFormEndpoint());

      await request(app).get('/forms/form_123?cache=false');
      expect(cacheUsed).toBe(false);

      await request(app).get('/forms/form_123?cache=true');
      expect(cacheUsed).toBe(true);
    });
  });

  describe('Get Submissions Endpoint', () => {
    test('should retrieve submissions with pagination', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getSubmissions: async (formId, options) => ({
          submissions: [
            { id: 'sub1', formId },
            { id: 'sub2', formId },
          ],
          count: 2,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/submissions', getSubmissionsEndpoint());

      const response = await request(app).get(
        '/forms/form_123/submissions?limit=10&offset=0'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.submissions).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('limit');
    });

    test('should apply filters to submissions', async () => {
      const app = express();
      app.use(express.json());

      let capturedOptions;
      const mockCheckOps = {
        getSubmissions: async (formId, options) => {
          capturedOptions = options;
          return { submissions: [], count: 0 };
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/submissions', getSubmissionsEndpoint());

      await request(app).get(
        '/forms/form_123/submissions?status=completed&limit=25'
      );

      expect(capturedOptions.status).toBe('completed');
      expect(capturedOptions.limit).toBe(25);
    });

    test('should handle submission retrieval errors', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getSubmissions: async () => {
          throw new Error('Database error');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/submissions', getSubmissionsEndpoint());

      const response = await request(app).get('/forms/form_123/submissions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Stats Endpoint', () => {
    test('should retrieve form statistics', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getStats: async (formId) => ({
          formId,
          totalSubmissions: 25,
          completionRate: 0.95,
          averageCompletionTime: 300,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/stats', getStatsEndpoint());

      const response = await request(app).get('/forms/form_123/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSubmissions).toBe(25);
    });

    test('should support cache control', async () => {
      const app = express();
      app.use(express.json());

      let cacheUsed = true;
      const mockCheckOps = {
        getStats: async (formId, useCache) => {
          cacheUsed = useCache;
          return { formId, totalSubmissions: 10 };
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/stats', getStatsEndpoint());

      await request(app).get('/forms/form_123/stats?cache=false');
      expect(cacheUsed).toBe(false);

      await request(app).get('/forms/form_123/stats');
      expect(cacheUsed).toBe(true);
    });

    test('should handle stats retrieval errors', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getStats: async () => {
          throw new Error('Stats calculation failed');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/forms/:formId/stats', getStatsEndpoint());

      const response = await request(app).get('/forms/form_123/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        healthCheck: async () => ({
          status: 'healthy',
          uptime: 5000,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/health', healthCheckEndpoint());

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    test('should return 503 when unhealthy', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        healthCheck: async () => ({
          status: 'unhealthy',
          error: 'Database disconnected',
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/health', healthCheckEndpoint());

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });

    test('should handle health check errors', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        healthCheck: async () => {
          throw new Error('Health check failed');
        },
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/health', healthCheckEndpoint());

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('Metrics Endpoint', () => {
    test('should return metrics', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getMetrics: () => ({
          totalForms: 10,
          totalSubmissions: 50,
          averageResponseTime: 150,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/metrics', metricsEndpoint());

      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalForms).toBe(10);
      expect(response.body.data.totalSubmissions).toBe(50);
    });

    test('should return empty metrics for new instance', async () => {
      const app = express();
      app.use(express.json());

      const mockCheckOps = {
        getMetrics: () => ({
          totalForms: 0,
          totalSubmissions: 0,
          averageResponseTime: 0,
        }),
      };

      app.use((req, res, next) => {
        req.checkops = mockCheckOps;
        next();
      });
      app.get('/metrics', metricsEndpoint());

      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.totalForms).toBe(0);
    });
  });

  describe('Error Handler', () => {
    test('should handle validation errors', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Validation error: invalid format'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('VALIDATION_ERROR');
    });

    test('should handle not found errors', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Resource not found'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('NOT_FOUND_ERROR');
    });

    test('should handle duplicate errors', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Duplicate key: form_name'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.status).toBe(409);
      expect(response.body.error.type).toBe('DUPLICATE_ERROR');
    });

    test('should handle connection errors', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Database connection timeout'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('CONNECTION_ERROR');
    });

    test('should handle generic errors', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Unexpected server error'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.type).toBe('INTERNAL_ERROR');
    });

    test('should include timestamp in error response', async () => {
      const app = express();
      app.use(express.json());

      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });
      app.use(checkOpsErrorHandler());

      const response = await request(app).get('/test');

      expect(response.body.error).toHaveProperty('timestamp');
      expect(new Date(response.body.error.timestamp)).toBeInstanceOf(Date);
    });
  });
});
