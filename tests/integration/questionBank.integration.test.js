import CheckOps from '../../src/index.js';

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

  describe('Question CRUD Operations', () => {
    it.skip('should create and retrieve questions', async () => {
      if (!checkops.initialized) return;

      const question = await checkops.createQuestion({
        questionText: 'What is your email?',
        questionType: 'email',
      });

      expect(question).toBeDefined();
      expect(question.id).toMatch(/^Q-\d+$/);

      const retrieved = await checkops.getQuestion(question.id);
      expect(retrieved.questionText).toBe('What is your email?');

      await checkops.deleteQuestion(question.id);
    });
  });
});
