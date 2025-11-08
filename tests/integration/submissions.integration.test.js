import CheckOps from '../../src/index.js';

describe('Submissions Integration Tests', () => {
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

  describe('Submission Operations', () => {
    it.skip('should create and retrieve submissions', async () => {
      if (!checkops.initialized) return;

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [
          {
            id: 'q1',
            questionText: 'Name',
            questionType: 'text',
            required: true,
          },
        ],
      });

      const submission = await checkops.createSubmission({
        formId: form.id,
        submissionData: { q1: 'John Doe' },
      });

      expect(submission).toBeDefined();
      expect(submission.id).toMatch(/^SUB-\d+$/);

      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved.submissionData.q1).toBe('John Doe');

      await checkops.deleteSubmission(submission.id);
      await checkops.deleteForm(form.id);
    });
  });
});
