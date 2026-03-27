import { Question } from '../models/Question.js';
import { validateRequired, validateString, validateQuestionType } from '../utils/validation.js';
import { sanitizeString, sanitizeObject } from '../utils/sanitization.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { OptionUtils } from '../utils/optionUtils.js';
import { getPool } from '../config/database.js';
import { checkOpsCache } from '../utils/cache.js';

export class QuestionService {
  async createQuestion({ questionText, questionType, options = null, validationRules = null, metadata = {} }) {
    validateRequired(questionText, 'Question text');
    validateString(questionText, 'Question text', 1, 5000);
    validateRequired(questionType, 'Question type');

    if (!validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    const sanitizedQuestionText = sanitizeString(questionText);
    const sanitizedValidationRules = validationRules ? sanitizeObject(validationRules) : null;
    const sanitizedMetadata = sanitizeObject(metadata);

    if (OptionUtils.requiresOptions(questionType) && !options) {
      throw new ValidationError(`Question type '${questionType}' requires options`);
    }

    const questionId = null;
    let processedOptions = null;
    if (options) {
      if (OptionUtils.requiresOptions(questionType)) {
        processedOptions = OptionUtils.processOptions(options, questionId);
      } else {
        processedOptions = options ? sanitizeObject(options) : null;
      }
    }

    return await Question.create({
      questionText: sanitizedQuestionText,
      questionType,
      options: processedOptions,
      validationRules: sanitizedValidationRules,
      metadata: sanitizedMetadata,
    });
  }

  /**
   * Get question by UUID (internal use)
   * @param {string} uuid - Question UUID
   * @returns {Promise<Question>}
   */
  async getQuestionById(uuid) {
    validateRequired(uuid, 'Question UUID');
    return await Question.findById(uuid);
  }

  async getQuestionsByIds(uuids) {
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
      return [];
    }
    return await Question.findByIds(uuids);
  }

  async getAllQuestions({ questionType = null, isActive = null, limit = 100, offset = 0 } = {}) {
    if (questionType && !validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    return await Question.findAll({ questionType, isActive, limit, offset });
  }

  /**
   * Update question by UUID (internal use)
   * @param {string} uuid - Question UUID
   * @param {object} updates - Updates to apply
   * @returns {Promise<Question>}
   */
  async updateQuestionById(uuid, updates) {
    validateRequired(uuid, 'Question UUID');

    const question = await Question.findById(uuid);
    const sanitizedUpdates = {};

    if (updates.questionText !== undefined) {
      validateString(updates.questionText, 'Question text', 1, 5000);
      sanitizedUpdates.questionText = sanitizeString(updates.questionText);
    }

    if (updates.questionType !== undefined) {
      if (!validateQuestionType(updates.questionType)) {
        throw new ValidationError(`Invalid question type: ${updates.questionType}`);
      }
      sanitizedUpdates.questionType = updates.questionType;
    }

    if (updates.options !== undefined) {
      const questionType = updates.questionType || question.questionType;
      if (updates.options && OptionUtils.requiresOptions(questionType)) {
        sanitizedUpdates.options = OptionUtils.processOptions(updates.options, uuid);
      } else {
        sanitizedUpdates.options = updates.options ? sanitizeObject(updates.options) : null;
      }
    }

    if (updates.validationRules !== undefined) {
      sanitizedUpdates.validationRules = updates.validationRules ? sanitizeObject(updates.validationRules) : null;
    }

    if (updates.metadata !== undefined) {
      sanitizedUpdates.metadata = sanitizeObject(updates.metadata);
    }

    if (updates.isActive !== undefined) {
      sanitizedUpdates.isActive = updates.isActive;
    }

    return await Question.updateById(uuid, sanitizedUpdates);
  }

  /**
   * Delete question by UUID (internal use)
   * @param {string} uuid - Question UUID
   * @returns {Promise<Question>}
   */
  async deleteQuestionById(uuid) {
    validateRequired(uuid, 'Question UUID');
    return await Question.deleteById(uuid);
  }

  /**
   * Deactivate question by UUID (internal use)
   * @param {string} uuid - Question UUID
   * @returns {Promise<Question>}
   */
  async deactivateQuestionById(uuid) {
    validateRequired(uuid, 'Question UUID');
    return await Question.updateById(uuid, { isActive: false });
  }

  /**
   * Activate question by UUID (internal use)
   * @param {string} uuid - Question UUID
   * @returns {Promise<Question>}
   */
  async activateQuestionById(uuid) {
    validateRequired(uuid, 'Question UUID');
    return await Question.updateById(uuid, { isActive: true });
  }

  async getQuestionCount({ questionType = null, isActive = null } = {}) {
    if (questionType && !validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    return await Question.count({ questionType, isActive });
  }

  /**
   * Update option label by question UUID (internal use)
   * @param {string} questionUuid - Question UUID
   * @param {string} optionKey - Option key
   * @param {string} newLabel - New label
   * @param {string} changedBy - User who made the change
   * @returns {Promise<Question>}
   */
  async updateOptionLabelById(questionUuid, optionKey, newLabel, changedBy = null) {
    validateRequired(questionUuid, 'Question UUID');
    validateRequired(optionKey, 'Option key');
    validateRequired(newLabel, 'New label');
    validateString(newLabel, 'New label', 1, 500);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const questionResult = await client.query(
        'SELECT * FROM question_bank WHERE id = $1 FOR UPDATE',
        [questionUuid]
      );

      if (questionResult.rows.length === 0) {
        throw new NotFoundError('Question', questionUuid);
      }

      const question = Question.fromRow(questionResult.rows[0]);

      if (!question.options || !Array.isArray(question.options)) {
        throw new ValidationError('Question does not have options');
      }

      const optionIndex = question.options.findIndex((opt) => opt.key === optionKey);
      if (optionIndex === -1) {
        throw new ValidationError(`Option with key '${optionKey}' not found`);
      }

      const oldLabel = question.options[optionIndex].label;

      if (oldLabel === newLabel) {
        await client.query('COMMIT');
        return question;
      }

      const sanitizedLabel = sanitizeString(newLabel);
      const updatedOptions = [...question.options];
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        label: sanitizedLabel,
      };

      const updatedQuestionResult = await client.query(
        `UPDATE question_bank
         SET options = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(updatedOptions), questionUuid]
      );

      await this._recordOptionLabelChange(
        questionUuid,
        optionKey,
        oldLabel,
        sanitizedLabel,
        changedBy,
        client
      );

      await client.query('COMMIT');

      // After successful update, invalidate stats cache for all forms using this question
      // Forms store questions as JSONB array, so we query to find matching forms
      const formsResult = await pool.query(
        `SELECT id, sid, questions FROM forms WHERE questions IS NOT NULL`
      );

      formsResult.rows.forEach(row => {
        const questions = Array.isArray(row.questions) ? row.questions : [];
        // Check if form uses this question (questionId can be UUID or SID)
        const usesThisQuestion = questions.some(q =>
          q.questionId === question.id || q.questionId === question.sid
        );
        if (usesThisQuestion) {
          checkOpsCache.deleteStats(row.id);
          checkOpsCache.deleteStats(row.sid);
        }
      });

      return Question.fromRow(updatedQuestionResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get option history by question UUID (internal use)
   * @param {string} questionUuid - Question UUID
   * @param {string} optionKey - Optional option key filter
   * @returns {Promise<Array>}
   */
  async getOptionHistoryById(questionUuid, optionKey = null) {
    validateRequired(questionUuid, 'Question UUID');

    const pool = getPool();
    let query = `
      SELECT id, question_id, option_key, old_label, new_label, changed_at, changed_by, change_reason
      FROM question_option_history
      WHERE question_id = $1
    `;
    const params = [questionUuid];

    if (optionKey) {
      query += ' AND option_key = $2';
      params.push(optionKey);
    }

    query += ' ORDER BY changed_at DESC';

    const result = await pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      questionId: row.question_id,
      optionKey: row.option_key,
      oldLabel: row.old_label,
      newLabel: row.new_label,
      changedAt: row.changed_at,
      changedBy: row.changed_by,
      changeReason: row.change_reason,
    }));
  }

  async _recordOptionLabelChange(questionId, optionKey, oldLabel, newLabel, changedBy = null, client = null) {
    const runner = client || getPool();

    // Get question SID for the history record
    const questionResult = await runner.query(
      `SELECT sid FROM question_bank WHERE id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      throw new Error(`Question not found: ${questionId}`);
    }

    const questionSid = questionResult.rows[0].sid;

    await runner.query(
      `INSERT INTO question_option_history (question_id, question_sid, option_key, old_label, new_label, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [questionId, questionSid, optionKey, oldLabel, newLabel, changedBy]
    );
  }
}
