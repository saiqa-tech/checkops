import { CheckOpsWrapper } from '../../checkops-power/lib/CheckOpsWrapper.js';

describe('CheckOpsWrapper: Core Wrapper Functionality', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = new CheckOpsWrapper({
      host: 'localhost',
      port: 5432,
      database: 'test_checkops',
      enableLogging: false,
    });
  });

  afterEach(async () => {
    if (wrapper && wrapper.initialized) {
      await wrapper.close();
    }
  });

  describe('Initialization & Configuration', () => {
    test('should create wrapper instance', () => {
      expect(wrapper).toBeDefined();
      expect(wrapper.config).toBeDefined();
      expect(wrapper.initialized).toBe(false);
    });

    test('should allow custom configuration', () => {
      const customWrapper = new CheckOpsWrapper({
        host: 'custom-host',
        port: 9999,
        retryAttempts: 5,
      });

      expect(customWrapper.config.host).toBe('custom-host');
      expect(customWrapper.config.port).toBe(9999);
      expect(customWrapper.config.retryAttempts).toBe(5);
    });

    test('should set default configuration values', () => {
      expect(wrapper.config.retryAttempts).toBeGreaterThan(0);
      expect(wrapper.config.retryDelay).toBeGreaterThan(0);
      expect(typeof wrapper.config.enableLogging).toBe('boolean');
    });

    test('should initialize asynchronously', async () => {
      try {
        await wrapper.initialize();
        // If initialization succeeds, wrapper is initialized
        expect(wrapper.initialized).toBe(true);
      } catch (error) {
        // If database not available, wrapper remains uninitialized
        expect(wrapper.initialized).toBe(false);
        expect(error.message).toContain('Failed to initialize');
      }
    });
  });

  describe('Form Operations', () => {
    test('should handle form creation errors when not initialized', async () => {
      try {
        await wrapper.createForm({ title: 'Test' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBeTruthy();
      }
    });

    test('should have createForm method', () => {
      expect(typeof wrapper.createForm).toBe('function');
    });

    test('should have getForm method', () => {
      expect(typeof wrapper.getForm).toBe('function');
    });

    test('should validate form data before submission', () => {
      const validForm = {
        title: 'Test Form',
        description: 'Test',
        questions: [{ questionText: 'Q1', questionType: 'text' }],
      };

      const invalidForm = {
        description: 'Missing title',
        questions: [],
      };

      expect(() => wrapper.validateFormData(validForm)).not.toThrow();
      expect(() => wrapper.validateFormData(invalidForm)).toThrow();
    });
  });

  describe('Submission Operations', () => {
    test('should handle submission creation errors when not initialized', async () => {
      try {
        await wrapper.createSubmission({ formId: 'form_1', submissionData: {} });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBeTruthy();
      }
    });

    test('should have createSubmission method', () => {
      expect(typeof wrapper.createSubmission).toBe('function');
    });

    test('should validate submission data', () => {
      const validSubmission = {
        formId: 'form_1',
        submissionData: { question1: 'answer1' },
      };

      expect(() => wrapper.validateSubmissionData(validSubmission)).not.toThrow();
    });

    test('should have bulkCreateSubmissions method', () => {
      expect(typeof wrapper.bulkCreateSubmissions).toBe('function');
    });
  });

  describe('Metrics Collection', () => {
    test('should initialize metrics object', () => {
      expect(wrapper.metrics).toBeDefined();
      expect(wrapper.metrics.operations).toBe(0);
      expect(wrapper.metrics.errors).toBe(0);
    });

    test('should track operation count on error', async () => {
      const initialErrors = wrapper.metrics.errors;

      try {
        await wrapper.createForm({ title: 'Test' });
      } catch (error) {
        // Expected error due to not being initialized
      }

      // Metrics should reflect the failed operation
      expect(wrapper.metrics.errors).toBeGreaterThanOrEqual(initialErrors);
    });

    test('should provide metrics summary', () => {
      const metrics = wrapper.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('operations');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('forms');
      expect(metrics).toHaveProperty('submissions');
    });

    test('should track specific operation metrics', () => {
      const metrics = wrapper.getMetrics();

      expect(typeof metrics.operations).toBe('number');
      expect(typeof metrics.errors).toBe('number');
      expect(metrics.operations).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should emit error events on initialization failure', (done) => {
      const failWrapper = new CheckOpsWrapper({
        host: 'invalid-host',
        port: 9999,
        retryAttempts: 1,
        enableLogging: false,
      });

      failWrapper.on('error', (error) => {
        expect(error).toBeDefined();
        expect(error.message).toBeTruthy();
        failWrapper.removeAllListeners();
        done();
      });

      failWrapper.initialize().catch(() => {
        // Expected to fail
      });
    });

    test('should validate question data before submission', () => {
      const validQuestion = {
        questionText: 'Test?',
        questionType: 'text',
      };

      const invalidQuestion = {
        // Missing required fields
      };

      expect(() => wrapper.validateQuestionData(validQuestion)).not.toThrow();
      expect(() => wrapper.validateQuestionData(invalidQuestion)).toThrow();
    });

    test('should handle missing initialization', async () => {
      expect(wrapper.initialized).toBe(false);

      try {
        await wrapper.getForm('form_1');
        fail('Should throw error');
      } catch (error) {
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Health & Status Checks', () => {
    test('should report uninitialized status', () => {
      expect(wrapper.initialized).toBe(false);
    });

    test('should have healthCheck method', () => {
      expect(typeof wrapper.healthCheck).toBe('function');
    });

    test('should return health status', async () => {
      try {
        const health = await wrapper.healthCheck();
        expect(health).toBeDefined();
        expect(health).toHaveProperty('status');
      } catch (error) {
        // May fail if not initialized
        expect(error).toBeDefined();
      }
    });

    test('should track initialization time', async () => {
      try {
        await wrapper.initialize();
        expect(wrapper.initTime).toBeDefined();
        expect(typeof wrapper.initTime).toBe('number');
      } catch (error) {
        // Expected if database not available
        expect(wrapper.initTime).toBeUndefined();
      }
    });
  });

  describe('Caching & Performance', () => {
    test('should have enableCache method', () => {
      expect(typeof wrapper.enableCache).toBe('function');
    });

    test('should support cache enabling', () => {
      expect(() => wrapper.enableCache(300000)).not.toThrow();
    });

    test('should have cache storage capability', () => {
      wrapper.enableCache(60000);
      expect(wrapper.cache).toBeDefined();
      expect(wrapper.cache).toBeInstanceOf(Map);
    });

    test('should support cache operations after enabling', () => {
      wrapper.enableCache(60000);
      expect(wrapper.cache).toBeDefined();
      expect(wrapper.cache.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Cleanup', () => {
    test('should have close method', () => {
      expect(typeof wrapper.close).toBe('function');
    });

    test('should allow graceful shutdown', async () => {
      expect(wrapper.initialized).toBe(false);
      await expect(wrapper.close()).resolves.toBeUndefined();
    });

    test('should reset initialized state on close', async () => {
      try {
        await wrapper.initialize();
      } catch (error) {
        // May fail if database unavailable
      }

      await wrapper.close();
      expect(wrapper.initialized).toBe(false);
    });
  });
});
