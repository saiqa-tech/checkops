import { Question } from '../models/Question.js';
import { validateRequired, validateString, validateQuestionType } from '../utils/validation.js';
import { sanitizeString, sanitizeObject } from '../utils/sanitization.js';
import { ValidationError } from '../utils/errors.js';

export class QuestionService {
  async createQuestion({ questionText, questionType, options = null, validationRules = null, metadata = {} }) {
    validateRequired(questionText, 'Question text');
    validateString(questionText, 'Question text', 1, 5000);
    validateRequired(questionType, 'Question type');

    if (!validateQuestionType(questionType)) {
      throw new ValidationError(`Invalid question type: ${questionType}`);
    }

    const sanitizedQuestionText = sanitizeString(questionText);
    const sanitizedOptions = options ? sanitizeObject(options) : null;
    const sanitizedValidationRules = validationRules ? sanitizeObject(validationRules) : null;
    const sanitizedMetadata = sanitizeObject(metadata);

    if (['select', 'multiselect', 'radio', 'checkbox'].includes(questionType) && !options) {
      throw new ValidationError(`Question type '${questionType}' requires options`);
    }

    return await Question.create({
      questionText: sanitizedQuestionText,
      questionType,
      options: sanitizedOptions,
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
      sanitizedUpdates.options = updates.options ? sanitizeObject(updates.options) : null;
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
}
