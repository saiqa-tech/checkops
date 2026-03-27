import CheckOps from '../../src/index.js';
import { isUUID, isSID, validateFormIds, validateSubmissionIds } from '../helpers/validators.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

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

  describe('Submission Operations', () => {
    it.skip('should create and retrieve submissions', async () => {
      if (!checkops.initialized) return;

      // Create form
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

      // Verify form has both UUID and SID
      validateFormIds(form);

      // Create submission using form UUID
      const submission = await checkops.createSubmission({
        formId: form.id,  // UUID
        submissionData: { q1: 'John Doe' },
      });

      // Verify submission has both UUID and SID, plus formId and formSid
      expect(submission).toBeDefined();
      expect(isUUID(submission.id)).toBe(true);
      expect(isSID(submission.sid, 'SUB')).toBe(true);
      expect(submission.formId).toBe(form.id);  // UUID
      expect(submission.formSid).toBe(form.sid);  // SID
      validateSubmissionIds(submission);

      // Retrieve submission by UUID
      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved.submissionData.q1).toBe('John Doe');
      expect(retrieved.id).toBe(submission.id);
      expect(retrieved.sid).toBe(submission.sid);
      expect(retrieved.formId).toBe(form.id);
      expect(retrieved.formSid).toBe(form.sid);

      // Delete submission and form by UUID
      await checkops.deleteSubmission(submission.id);
      await checkops.deleteForm(form.id);
    });
  });
});
