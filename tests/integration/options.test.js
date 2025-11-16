import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

describe('Options Integration Tests', () => {
  let checkops;
  let pool;

  beforeAll(async () => {
    checkops = new CheckOps({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'checkops_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
      await checkops.initialize();
      pool = getPool();
    } catch (error) {
      console.log('Database not available, skipping integration tests');
      checkops = null;
    }
  });

  afterAll(async () => {
    if (checkops) {
      await checkops.close();
    }
  });

  beforeEach(async () => {
    if (!checkops) {
      return;
    }

    await pool.query('DELETE FROM submissions');
    await pool.query('DELETE FROM forms');
    await pool.query('DELETE FROM question_bank');
    await pool.query('DELETE FROM question_option_history');
    await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");
  });

  describe('Simple Array Options', () => {
    test('should create question with simple array and auto-generate keys', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select a color',
        questionType: 'select',
        options: ['Red', 'Blue', 'Green'],
      });

      expect(question.options).toHaveLength(3);
      expect(question.options[0]).toHaveProperty('key');
      expect(question.options[0]).toHaveProperty('label', 'Red');
      expect(question.options[0].key).toMatch(/^opt_red_[a-f0-9]{6}$/);
    });
  });

  describe('Structured Options', () => {
    test('should create question with structured options', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [
          { key: 'priority_high', label: 'High Priority' },
          { key: 'priority_medium', label: 'Medium Priority' },
          { key: 'priority_low', label: 'Low Priority' },
        ],
      });

      expect(question.options).toHaveLength(3);
      expect(question.options[0].key).toBe('priority_high');
      expect(question.options[0].label).toBe('High Priority');
    });

    test('should reject duplicate keys', async () => {
      if (!checkops) return;

      await expect(
        checkops.createQuestion({
          questionText: 'Select priority',
          questionType: 'select',
          options: [
            { key: 'same_key', label: 'High' },
            { key: 'same_key', label: 'Low' },
          ],
        })
      ).rejects.toThrow('Option keys must be unique');
    });
  });

  describe('Submission with Options', () => {
    test('should accept label and convert to key on submission', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High Priority' }],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      const submission = await checkops.createSubmission({
        formId: form.id,
        submissionData: {
          [question.id]: 'High Priority',
        },
      });

      expect(submission._rawData[question.id]).toBe('priority_high');
      expect(submission.submissionData[question.id]).toBe('High Priority');
    });

    test('should accept key directly on submission', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High Priority' }],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      const submission = await checkops.createSubmission({
        formId: form.id,
        submissionData: {
          [question.id]: 'priority_high',
        },
      });

      expect(submission._rawData[question.id]).toBe('priority_high');
      expect(submission.submissionData[question.id]).toBe('High Priority');
    });

    test('should handle multiselect with mixed keys and labels', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select colors',
        questionType: 'multiselect',
        options: [
          { key: 'color_red', label: 'Red' },
          { key: 'color_blue', label: 'Blue' },
          { key: 'color_green', label: 'Green' },
        ],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      const submission = await checkops.createSubmission({
        formId: form.id,
        submissionData: {
          [question.id]: ['Red', 'color_blue'],
        },
      });

      expect(submission._rawData[question.id]).toEqual(['color_red', 'color_blue']);
      expect(submission.submissionData[question.id]).toEqual(['Red', 'Blue']);
    });
  });

  describe('Option Label Updates', () => {
    test('should update label without changing key', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High Priority' }],
      });

      const updatedQuestion = await checkops.updateOptionLabel(
        question.id,
        'priority_high',
        'Critical Priority',
        'admin@example.com'
      );

      expect(updatedQuestion.options[0].key).toBe('priority_high');
      expect(updatedQuestion.options[0].label).toBe('Critical Priority');
    });

    test('should maintain data integrity after label change', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High Priority' }],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      const sub1 = await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: 'High Priority' },
      });

      await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical Priority');

      const sub2 = await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: 'Critical Priority' },
      });

      expect(sub1._rawData[question.id]).toBe('priority_high');
      expect(sub2._rawData[question.id]).toBe('priority_high');

      const retrieved1 = await checkops.getSubmission(sub1.id);
      expect(retrieved1.submissionData[question.id]).toBe('Critical Priority');

      const retrieved2 = await checkops.getSubmission(sub2.id);
      expect(retrieved2.submissionData[question.id]).toBe('Critical Priority');
    });

    test('should track option history', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High Priority' }],
      });

      await checkops.updateOptionLabel(
        question.id,
        'priority_high',
        'Critical Priority',
        'admin@example.com'
      );

      const history = await checkops.getOptionHistory(question.id, 'priority_high');

      expect(history).toHaveLength(1);
      expect(history[0].questionId).toBe(question.id);
      expect(history[0].optionKey).toBe('priority_high');
      expect(history[0].oldLabel).toBe('High Priority');
      expect(history[0].newLabel).toBe('Critical Priority');
      expect(history[0].changedBy).toBe('admin@example.com');
    });
  });

  describe('Stats with Options', () => {
    test('should aggregate stats correctly after label change', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [
          { key: 'priority_high', label: 'High' },
          { key: 'priority_low', label: 'Low' },
        ],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: 'High' },
      });

      await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: 'High' },
      });

      await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical');

      await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: 'Critical' },
      });

      const stats = await checkops.getSubmissionStats(form.id);

      expect(stats.totalSubmissions).toBe(3);
      expect(stats.questionStats[question.id].totalAnswers).toBe(3);
      expect(stats.questionStats[question.id].answerDistribution['Critical']).toBe(3);
      expect(stats.questionStats[question.id]._keyDistribution['priority_high']).toBe(3);
    });

    test('should handle multiselect stats correctly', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select colors',
        questionType: 'multiselect',
        options: [
          { key: 'color_red', label: 'Red' },
          { key: 'color_blue', label: 'Blue' },
        ],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: ['Red', 'Blue'] },
      });

      await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: ['Red'] },
      });

      const stats = await checkops.getSubmissionStats(form.id);

      expect(stats.questionStats[question.id].answerDistribution['Red']).toBe(2);
      expect(stats.questionStats[question.id].answerDistribution['Blue']).toBe(1);
    });
  });

  describe('Validation', () => {
    test('should validate option values in submissions', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id, required: true }],
      });

      await expect(
        checkops.createSubmission({
          formId: form.id,
          submissionData: { [question.id]: 'Invalid Option' },
        })
      ).rejects.toThrow('Invalid option');
    });

    test('should validate multiselect array values', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select colors',
        questionType: 'multiselect',
        options: [{ key: 'color_red', label: 'Red' }],
      });

      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      await expect(
        checkops.createSubmission({
          formId: form.id,
          submissionData: { [question.id]: ['Red', 'Invalid'] },
        })
      ).rejects.toThrow('Invalid option');
    });
  });
});
