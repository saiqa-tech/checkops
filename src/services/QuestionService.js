import { Question } from '../models/Question.js';
import { validateRequired, validateString, validateQuestionType } from '../utils/validation.js';
import { sanitizeString, sanitizeObject } from '../utils/sanitization.js';
import { ValidationError } from '../utils/errors.js';
import { OptionUtils } from '../utils/optionUtils.js';
import { getPool } from '../config/database.js';

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

  async getQuestionById(id) {
    validateRequired(id, 'Question ID');
    return await Question.findById(id);
  }

  async getQuestionsByIds(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    return await Question.findByIds(ids);
  }

  async getAllQuestions({ questionType = null, isActive = null, limit = 100, offset = 0 } = {}) {
    if (questionType && !validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    return await Question.findAll({ questionType, isActive, limit, offset });
  }

  async updateQuestion(id, updates) {
    validateRequired(id, 'Question ID');

    const question = await Question.findById(id);
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
        sanitizedUpdates.options = OptionUtils.processOptions(updates.options, id);
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

    return await Question.update(id, sanitizedUpdates);
  }

  async deleteQuestion(id) {
    validateRequired(id, 'Question ID');
    return await Question.delete(id);
  }

  async deactivateQuestion(id) {
    validateRequired(id, 'Question ID');
    return await Question.update(id, { isActive: false });
  }

  async activateQuestion(id) {
    validateRequired(id, 'Question ID');
    return await Question.update(id, { isActive: true });
  }

  async getQuestionCount({ questionType = null, isActive = null } = {}) {
    if (questionType && !validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    return await Question.count({ questionType, isActive });
  }

  async updateOptionLabel(questionId, optionKey, newLabel, changedBy = null) {
    validateRequired(questionId, 'Question ID');
    validateRequired(optionKey, 'Option key');
    validateRequired(newLabel, 'New label');
    validateString(newLabel, 'New label', 1, 500);

    const question = await Question.findById(questionId);

    if (!question.options || !Array.isArray(question.options)) {
      throw new ValidationError('Question does not have options');
    }

    const optionIndex = question.options.findIndex((opt) => opt.key === optionKey);
    if (optionIndex === -1) {
      throw new ValidationError(`Option with key '${optionKey}' not found`);
    }

    const oldLabel = question.options[optionIndex].label;

    if (oldLabel === newLabel) {
      return question;
    }

    const updatedOptions = [...question.options];
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      label: sanitizeString(newLabel),
    };

    await this._recordOptionLabelChange(questionId, optionKey, oldLabel, newLabel, changedBy);

    return await Question.update(questionId, { options: updatedOptions });
  }

  async getOptionHistory(questionId, optionKey = null) {
    validateRequired(questionId, 'Question ID');

    const pool = getPool();
    let query = `
      SELECT id, question_id, option_key, old_label, new_label, changed_at, changed_by, change_reason
      FROM question_option_history
      WHERE question_id = $1
    `;
    const params = [questionId];

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

  async _recordOptionLabelChange(questionId, optionKey, oldLabel, newLabel, changedBy = null) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO question_option_history (question_id, option_key, old_label, new_label, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [questionId, optionKey, oldLabel, newLabel, changedBy]
    );
  }
}
