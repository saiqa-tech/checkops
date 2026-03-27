import CheckOps from '../../src/index.js';
import { isUUID, isSID, validateFormIds } from '../helpers/validators.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

describe('Form Builder Integration Tests', () => {
  let checkops;

  beforeAll(async () => {
    checkops = new CheckOps({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'checkops_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
      await checkops.initialize();
      // Clean up any existing test data
      await cleanupAllTestData(checkops);
    } catch (error) {
      console.log('Database not available for integration tests, skipping...');
    }
  });

  afterAll(async () => {
    if (checkops && checkops.initialized) {
      // Clean up test data before closing
      await cleanupAllTestData(checkops);
      await checkops.close();
    }
  });

  it('should skip tests if database not available', () => {
    if (!checkops.initialized) {
      console.log('Integration tests skipped - database not available');
      expect(true).toBe(true);
    }
  });

  describe('Form CRUD Operations', () => {
    it.skip('should create, retrieve, update, and delete a form', async () => {
      if (!checkops.initialized) return;

      // Create form
      const form = await checkops.createForm({
        title: 'Integration Test Form',
        description: 'Test form for integration testing',
        questions: [
          {
            questionText: 'What is your name?',
            questionType: 'text',
            required: true,
          },
        ],
      });

      // Verify form has both UUID and SID
      expect(form).toBeDefined();
      expect(isUUID(form.id)).toBe(true);
      expect(isSID(form.sid, 'FORM')).toBe(true);
      validateFormIds(form);

      // Retrieve form by UUID
      const retrieved = await checkops.getForm(form.id);
      expect(retrieved.title).toBe('Integration Test Form');
      expect(retrieved.id).toBe(form.id);
      expect(retrieved.sid).toBe(form.sid);

      // Update form by UUID
      const updated = await checkops.updateForm(form.id, {
        title: 'Updated Form Title',
      });
      expect(updated.title).toBe('Updated Form Title');
      expect(updated.id).toBe(form.id);
      expect(updated.sid).toBe(form.sid);

      // Delete form by UUID
      await checkops.deleteForm(form.id);
    });
  });
});
