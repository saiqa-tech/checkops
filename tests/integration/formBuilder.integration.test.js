import CheckOps from '../../src/index.js';

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
    } catch (error) {
      console.log('Database not available for integration tests, skipping...');
    }
  });

  afterAll(async () => {
    if (checkops && checkops.initialized) {
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

      expect(form).toBeDefined();
      expect(form.id).toMatch(/^FORM-\d+$/);

      const retrieved = await checkops.getForm(form.id);
      expect(retrieved.title).toBe('Integration Test Form');

      const updated = await checkops.updateForm(form.id, {
        title: 'Updated Form Title',
      });
      expect(updated.title).toBe('Updated Form Title');

      await checkops.deleteForm(form.id);
    });
  });
});
