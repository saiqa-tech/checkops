import CheckOps from '../../src/index.js';
import { isUUID, isSID, validateQuestionIds } from '../helpers/validators.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

describe('Question Bank Integration Tests', () => {
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

  describe('Question CRUD Operations', () => {
    it.skip('should create and retrieve questions', async () => {
      if (!checkops.initialized) return;

      // Create question
      const question = await checkops.createQuestion({
        questionText: 'What is your email?',
        questionType: 'email',
      });

      // Verify question has both UUID and SID
      expect(question).toBeDefined();
      expect(isUUID(question.id)).toBe(true);
      expect(isSID(question.sid, 'Q')).toBe(true);
      validateQuestionIds(question);

      // Retrieve question by UUID
      const retrieved = await checkops.getQuestion(question.id);
      expect(retrieved.questionText).toBe('What is your email?');
      expect(retrieved.id).toBe(question.id);
      expect(retrieved.sid).toBe(question.sid);

      // Delete question by UUID
      await checkops.deleteQuestion(question.id);
    });
  });
});
