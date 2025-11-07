import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { CheckOpsServer } from '../../src/server/app.js';
import { ApiKeyModel } from '../../src/server/models/ApiKey.js';
import { FormModel } from '../../src/server/models/Form.js';

describe('CheckOps Form Builder API Integration Tests', () => {
  let server: CheckOpsServer;
  let app: any;
  let apiKey: string;
  let apiKeyId: string;
  let formId: string;

  beforeAll(async () => {
    server = new CheckOpsServer();
    await server.initialize();
    app = server.getApp();

    // Create API key for testing
    const apiKeyModel = new ApiKeyModel();
    const result = await apiKeyModel.createApiKey({
      name: 'Test API Key',
      description: 'API key for integration tests',
      permissions: ['*'], // All permissions for testing
      rateLimitPerHour: 10000
    });
    apiKey = result.apiKey;
    apiKeyId = result.details.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (apiKeyId) {
      const apiKeyModel = new ApiKeyModel();
      await apiKeyModel.deleteApiKey(apiKeyId);
    }
  });

  beforeEach(async () => {
    // Clean up any test forms created in previous tests
    if (formId) {
      const formModel = new FormModel();
      try {
        await formModel.deleteForm(formId);
      } catch (error) {
        // Ignore if form doesn't exist
      }
      formId = '';
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        environment: 'test'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('API Documentation', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'CheckOps Form Builder API',
        version: '2.0.0'
      });
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('Forms API', () => {
    const testForm = {
      title: 'Test Contact Form',
      description: 'A test form for contact information',
      version: '1.0.0',
      schema: {
        id: 'contact-form',
        title: 'Contact Form',
        fields: [
          {
            name: 'fullName',
            type: 'text',
            required: true,
            minLength: 2
          },
          {
            name: 'email',
            type: 'email',
            required: true
          },
          {
            name: 'message',
            type: 'textarea',
            required: true,
            minLength: 10
          }
        ]
      }
    };

    it('should create a new form', async () => {
      const response = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(testForm)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: testForm.title,
        description: testForm.description,
        status: 'active'
      });
      expect(response.body.data.id).toBeDefined();
      formId = response.body.data.id;
    });

    it('should get a form by ID', async () => {
      // First create a form
      const createResponse = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(testForm)
        .expect(201);

      formId = createResponse.body.data.id;

      // Then get it
      const response = await request(app)
        .get(`/api/v1/forms/${formId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(formId);
      expect(response.body.data.title).toBe(testForm.title);
    });

    it('should list forms', async () => {
      // Create a form first
      await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(testForm)
        .expect(201);

      const response = await request(app)
        .get('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should update a form', async () => {
      // Create a form first
      const createResponse = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(testForm)
        .expect(201);

      formId = createResponse.body.data.id;

      const updateData = {
        title: 'Updated Test Form',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/forms/${formId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it('should delete a form', async () => {
      // Create a form first
      const createResponse = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(testForm)
        .expect(201);

      formId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/forms/${formId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent form', async () => {
      const response = await request(app)
        .get('/api/v1/forms/non-existent-id')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);

      expect(response.body.error).toBe('Form not found');
    });
  });

  describe('Submissions API', () => {
    const testForm = {
      title: 'Test Submission Form',
      schema: {
        id: 'submission-test-form',
        fields: [
          {
            name: 'name',
            type: 'text',
            required: true
          },
          {
            name: 'email',
            type: 'email',
            required: true
          }
        ]
      }
    };

    beforeEach(async () => {
      // Create a form for submission tests
      const formModel = new FormModel();
      const form = await formModel.createForm(testForm.schema);
      formId = form.id;
    });

    it('should create a submission', async () => {
      const submissionData = {
        data: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      const response = await request(app)
        .post(`/api/v1/forms/${formId}/submissions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send(submissionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        formId,
        status: 'processed'
      });
      expect(response.body.data.submissionId).toBeDefined();
    });

    it('should validate submission data', async () => {
      const submissionData = {
        data: {
          name: 'J', // Too short
          email: 'invalid-email' // Invalid format
        }
      };

      const response = await request(app)
        .post(`/api/v1/forms/${formId}/submissions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send(submissionData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.validationErrors).toBeDefined();
    });

    it('should list submissions', async () => {
      // Create a submission first
      await request(app)
        .post(`/api/v1/forms/${formId}/submissions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          data: { name: 'Test User', email: 'test@example.com' }
        });

      const response = await request(app)
        .get('/api/v1/submissions')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get submission statistics', async () => {
      const response = await request(app)
        .get('/api/v1/submissions/stats')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        pending: expect.any(Number),
        processed: expect.any(Number),
        failed: expect.any(Number)
      });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/v1/forms')
        .expect(401);

      expect(response.body.error).toBe('Missing authorization header');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/forms')
        .set('Authorization', 'Bearer invalid-key')
        .expect(401);

      expect(response.body.error).toBe('Invalid API key');
    });

    it('should reject requests with insufficient permissions', async () => {
      // Create API key with limited permissions
      const limitedApiKeyModel = new ApiKeyModel();
      const limitedResult = await limitedApiKeyModel.createApiKey({
        name: 'Limited API Key',
        permissions: ['forms:read'], // Only read permissions
        rateLimitPerHour: 1000
      });

      const response = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${limitedResult.apiKey}`)
        .send({ title: 'Test' })
        .expect(403);

      expect(response.body.error).toBe('Forbidden');

      // Clean up
      await limitedApiKeyModel.deleteApiKey(limitedResult.details.id);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ title: '' }) // Invalid data
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.details).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});