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

      // Need to retrieve to get _rawData and submissionData transforms
      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved._rawData[question.id]).toBe('priority_high');
      expect(retrieved.submissionData[question.id]).toBe('High Priority');
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

      // Need to retrieve to get _rawData and submissionData transforms
      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved._rawData[question.id]).toBe('priority_high');
      expect(retrieved.submissionData[question.id]).toBe('High Priority');
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

      // Need to retrieve to get _rawData and submissionData transforms
      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved._rawData[question.id]).toEqual(['color_red', 'color_blue']);
      expect(retrieved.submissionData[question.id]).toEqual(['Red', 'Blue']);
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

      // Retrieve to get _rawData
      const retrieved1 = await checkops.getSubmission(sub1.id);
      const retrieved2 = await checkops.getSubmission(sub2.id);

      expect(retrieved1._rawData[question.id]).toBe('priority_high');
      expect(retrieved2._rawData[question.id]).toBe('priority_high');

      // Both should now show updated label
      expect(retrieved1.submissionData[question.id]).toBe('Critical Priority');
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
      ).rejects.toThrow('Validation failed');
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
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('JSONB Persistence and Database Validation', () => {
    test('should store options as JSONB in database with correct structure', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [
          { key: 'priority_high', label: 'High Priority' },
          { key: 'priority_low', label: 'Low Priority' },
        ],
      });

      // Query database directly to verify JSONB structure
      const result = await pool.query(
        'SELECT options FROM question_bank WHERE id = $1',
        [question.id]
      );

      const storedOptions = result.rows[0].options;
      expect(Array.isArray(storedOptions)).toBe(true);
      expect(storedOptions).toHaveLength(2);
      expect(storedOptions[0]).toHaveProperty('key', 'priority_high');
      expect(storedOptions[0]).toHaveProperty('label', 'High Priority');
      expect(storedOptions[0]).toHaveProperty('order');
      expect(storedOptions[0]).toHaveProperty('metadata');
      expect(storedOptions[0]).toHaveProperty('disabled');
      expect(storedOptions[0]).toHaveProperty('createdAt');
    });

    test('should enforce unique key constraint within JSONB', async () => {
      if (!checkops) return;

      // This should be caught by application logic before hitting database
      await expect(
        checkops.createQuestion({
          questionText: 'Select priority',
          questionType: 'select',
          options: [
            { key: 'same_key', label: 'Option 1' },
            { key: 'same_key', label: 'Option 2' },
          ],
        })
      ).rejects.toThrow('Option keys must be unique');
    });

    test('should preserve option order in database', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [
          { key: 'opt_1', label: 'First', order: 3 },
          { key: 'opt_2', label: 'Second', order: 1 },
          { key: 'opt_3', label: 'Third', order: 2 },
        ],
      });

      const result = await pool.query(
        'SELECT options FROM question_bank WHERE id = $1',
        [question.id]
      );

      const storedOptions = result.rows[0].options;
      expect(storedOptions[0].order).toBe(3);
      expect(storedOptions[1].order).toBe(1);
      expect(storedOptions[2].order).toBe(2);
    });

    test('should store metadata as JSONB object', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select color',
        questionType: 'select',
        options: [
          {
            key: 'color_red',
            label: 'Red',
            metadata: { hexColor: '#FF0000', category: 'warm' }
          },
        ],
      });

      const result = await pool.query(
        'SELECT options FROM question_bank WHERE id = $1',
        [question.id]
      );

      const storedOptions = result.rows[0].options;
      expect(storedOptions[0].metadata).toEqual({ hexColor: '#FF0000', category: 'warm' });
    });
  });

  describe('Option Key Immutability', () => {
    test('should not allow key changes via updateOptionLabel', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      // updateOptionLabel should only change label, not key
      await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical');

      const updated = await checkops.getQuestion(question.id);
      expect(updated.options[0].key).toBe('priority_high'); // Key unchanged
      expect(updated.options[0].label).toBe('Critical'); // Label changed
    });

    test('should maintain key immutability across multiple label changes', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      const originalKey = question.options[0].key;

      await checkops.updateOptionLabel(question.id, originalKey, 'Critical');
      await checkops.updateOptionLabel(question.id, originalKey, 'Very Critical');
      await checkops.updateOptionLabel(question.id, originalKey, 'Extremely Critical');

      const updated = await checkops.getQuestion(question.id);
      expect(updated.options[0].key).toBe(originalKey);
      expect(updated.options[0].label).toBe('Extremely Critical');
    });
  });

  describe('Option History Tracking', () => {
    test('should create history record with timestamp', async () => {
      if (!checkops) return;

      const beforeUpdate = new Date();

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      await checkops.updateOptionLabel(
        question.id,
        'priority_high',
        'Critical',
        'admin@example.com'
      );

      const afterUpdate = new Date();

      const history = await checkops.getOptionHistory(question.id, 'priority_high');

      expect(history).toHaveLength(1);
      const historyRecord = history[0];

      const changedAt = new Date(historyRecord.changedAt);
      expect(changedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(changedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    test('should track multiple label changes in history', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical', 'user1');
      await checkops.updateOptionLabel(question.id, 'priority_high', 'Very Critical', 'user2');
      await checkops.updateOptionLabel(question.id, 'priority_high', 'Extremely Critical', 'user3');

      const history = await checkops.getOptionHistory(question.id, 'priority_high');

      expect(history).toHaveLength(3);

      // History might be in any order, so check that all 3 changes are present
      const changes = history.map(h => ({ from: h.oldLabel, to: h.newLabel, by: h.changedBy }));
      expect(changes).toContainEqual({ from: 'High', to: 'Critical', by: 'user1' });
      expect(changes).toContainEqual({ from: 'Critical', to: 'Very Critical', by: 'user2' });
      expect(changes).toContainEqual({ from: 'Very Critical', to: 'Extremely Critical', by: 'user3' });
    });

    test('should retrieve history by question and option key', async () => {
      if (!checkops) return;

      const question1 = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      const question2 = await checkops.createQuestion({
        questionText: 'Select status',
        questionType: 'select',
        options: [{ key: 'status_active', label: 'Active' }],
      });

      await checkops.updateOptionLabel(question1.id, 'priority_high', 'Critical');
      await checkops.updateOptionLabel(question2.id, 'status_active', 'Live');

      const history1 = await checkops.getOptionHistory(question1.id, 'priority_high');
      const history2 = await checkops.getOptionHistory(question2.id, 'status_active');

      expect(history1).toHaveLength(1);
      expect(history1[0].optionKey).toBe('priority_high');

      expect(history2).toHaveLength(1);
      expect(history2[0].optionKey).toBe('status_active');
    });

    test('should handle null changedBy gracefully', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select priority',
        questionType: 'select',
        options: [{ key: 'priority_high', label: 'High' }],
      });

      await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical', null);

      const history = await checkops.getOptionHistory(question.id, 'priority_high');

      expect(history).toHaveLength(1);
      expect(history[0].changedBy).toBeNull();
    });
  });

  describe('Edge Cases for Options', () => {
    test('should handle options with extremely long labels (5000 characters)', async () => {
      if (!checkops) return;

      const longLabel = 'A'.repeat(5000);

      const question = await checkops.createQuestion({
        questionText: 'Select option',
        questionType: 'select',
        options: [{ key: 'long_opt', label: longLabel }],
      });

      expect(question.options[0].label).toBe(longLabel);
      expect(question.options[0].label.length).toBe(5000);
    });

    test('should handle 100+ options in single question', async () => {
      if (!checkops) return;

      const manyOptions = Array.from({ length: 150 }, (_, i) => ({
        key: `opt_${i}`,
        label: `Option ${i + 1}`,
      }));

      const question = await checkops.createQuestion({
        questionText: 'Select from many',
        questionType: 'select',
        options: manyOptions,
      });

      expect(question.options).toHaveLength(150);

      // Verify all stored correctly in database
      const result = await pool.query(
        'SELECT options FROM question_bank WHERE id = $1',
        [question.id]
      );

      expect(result.rows[0].options).toHaveLength(150);
    });

    test('should handle unicode and emoji in option labels', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select language',
        questionType: 'select',
        options: [
          { key: 'lang_ja', label: '日本語' },
          { key: 'lang_ko', label: '한국어' },
          { key: 'lang_zh', label: '中文' },
          { key: 'lang_ar', label: 'العربية' },
          { key: 'lang_emoji', label: '🔴🔵🟢' },
        ],
      });

      expect(question.options[0].label).toBe('日本語');
      expect(question.options[4].label).toBe('🔴🔵🟢');

      // Verify submission works with unicode labels
      const form = await checkops.createForm({
        title: 'Test Form',
        questions: [{ questionId: question.id }],
      });

      const submission = await checkops.createSubmission({
        formId: form.id,
        submissionData: { [question.id]: '日本語' },
      });

      // Retrieve to get the labels
      const retrieved = await checkops.getSubmission(submission.id);
      expect(retrieved.submissionData[question.id]).toBe('日本語');
      expect(retrieved._rawData[question.id]).toBe('lang_ja');
    });

    test('should handle empty option labels', async () => {
      if (!checkops) return;

      const question = await checkops.createQuestion({
        questionText: 'Select option',
        questionType: 'select',
        options: ['', 'Non-empty', ''],
      });

      expect(question.options).toHaveLength(3);
      expect(question.options[0].label).toBe('');
      expect(question.options[1].label).toBe('Non-empty');
      expect(question.options[2].label).toBe('');

      // Keys should still be unique
      const keys = question.options.map(opt => opt.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(3);
    });
  });
});
