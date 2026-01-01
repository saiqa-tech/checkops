import { Form } from '../models/Form.js';
import { Question } from '../models/Question.js';
import { validateRequired, validateString, validateQuestions } from '../utils/validation.js';
import { validateAndSanitizeFormInput } from '../utils/optimizedValidation.js';
import { sanitizeString, sanitizeObject } from '../utils/sanitization.js';
import { checkOpsCache } from '../utils/cache.js';
import { metricsCollector, performanceMonitor } from '../utils/metrics.js';

export class FormService {
  async createForm({ title, description = '', questions, metadata = {} }) {
    const start = performance.now();
    let error = null;

    try {
      // PHASE 3.2: Use optimized validation pipeline
      const sanitizedData = validateAndSanitizeFormInput({
        title,
        description,
        questions,
        metadata
      });

      const enrichedQuestions = await this.enrichQuestions(sanitizedData.questions);

      const form = await Form.create({
        title: sanitizedData.title,
        description: sanitizedData.description,
        questions: enrichedQuestions,
        metadata: sanitizedData.metadata,
      });

      // Cache the newly created form
      checkOpsCache.setForm(form.id, form);

      return form;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = performance.now() - start;
      metricsCollector.recordOperation('form_creation', duration, error);
      metricsCollector.recordValidation(duration, questions.length, error);
    }
  }

  async enrichQuestions(questions) {
    // OPTIMIZATION: Fix N+1 query problem by batching question lookups

    // Step 1: Collect all unique question IDs that need enrichment
    const questionIds = [...new Set(
      questions
        .filter(q => q.questionId)
        .map(q => q.questionId)
    )];

    // Early return if no questions need enrichment
    if (questionIds.length === 0) {
      return questions;
    }

    // Step 2: Check cache first for batch question data
    let bankQuestionsMap = new Map();
    const cachedQuestions = checkOpsCache.getQuestions(questionIds);

    if (cachedQuestions) {
      // Cache hit - use cached data
      bankQuestionsMap = new Map(
        cachedQuestions.map(q => [q.id, q])
      );
    } else {
      // Cache miss - fetch from database and cache result
      try {
        const bankQuestions = await Question.findByIds(questionIds);
        const questionsData = bankQuestions.map(q => q.toJSON());

        // Cache the questions for future use
        checkOpsCache.setQuestions(questionIds, questionsData);

        bankQuestionsMap = new Map(
          questionsData.map(q => [q.id, q])
        );
      } catch (error) {
        console.error('Failed to fetch bank questions in batch:', error);
        // Continue with empty map - questions will use fallback behavior
      }
    }

    // Step 3: Enrich questions using the cached map (O(n) instead of O(n²))
    return questions.map(question => {
      if (!question.questionId) {
        return question;
      }

      const bankQuestion = bankQuestionsMap.get(question.questionId);

      if (!bankQuestion) {
        // Fallback to original question if bank question not found
        return question;
      }

      // Merge question data with bank question data
      return {
        questionId: bankQuestion.id,
        questionText: question.questionText || bankQuestion.questionText,
        questionType: question.questionType || bankQuestion.questionType,
        options: question.options || bankQuestion.options,
        validationRules: question.validationRules || bankQuestion.validationRules,
        required: question.required || false,
        metadata: { ...bankQuestion.metadata, ...question.metadata },
      };
    });
  }

  async getFormById(id) {
    validateRequired(id, 'Form ID');

    // Try cache first
    const cached = checkOpsCache.getForm(id);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const form = await Form.findById(id);

    // Cache the result
    checkOpsCache.setForm(id, form);

    return form;
  }

  async getAllForms({ isActive = null, limit = 100, offset = 0 } = {}) {
    // Note: We don't cache list operations as they can vary by parameters
    // and would require more complex cache invalidation logic
    return await Form.findAll({ isActive, limit, offset });
  }

  async updateForm(id, updates) {
    validateRequired(id, 'Form ID');

    const sanitizedUpdates = {};

    if (updates.title !== undefined) {
      validateString(updates.title, 'Title', 1, 255);
      sanitizedUpdates.title = sanitizeString(updates.title);
    }

    if (updates.description !== undefined) {
      sanitizedUpdates.description = sanitizeString(updates.description);
    }

    if (updates.questions !== undefined) {
      validateQuestions(updates.questions);
      const sanitizedQuestions = sanitizeObject(updates.questions);
      sanitizedUpdates.questions = await this.enrichQuestions(sanitizedQuestions);
    }

    if (updates.metadata !== undefined) {
      sanitizedUpdates.metadata = sanitizeObject(updates.metadata);
    }

    if (updates.isActive !== undefined) {
      sanitizedUpdates.isActive = updates.isActive;
    }

    const updatedForm = await Form.update(id, sanitizedUpdates);

    // Invalidate cache for this form and related data
    checkOpsCache.invalidateForm(id);

    return updatedForm;
  }

  async deleteForm(id) {
    validateRequired(id, 'Form ID');

    const result = await Form.delete(id);

    // Invalidate cache for this form and related data
    checkOpsCache.invalidateForm(id);

    return result;
  }

  async deactivateForm(id) {
    validateRequired(id, 'Form ID');

    const result = await Form.update(id, { isActive: false });

    // Invalidate cache for this form
    checkOpsCache.invalidateForm(id);

    return result;
  }

  async activateForm(id) {
    validateRequired(id, 'Form ID');

    const result = await Form.update(id, { isActive: true });

    // Invalidate cache for this form
    checkOpsCache.invalidateForm(id);

    return result;
  }

  async getFormCount({ isActive = null } = {}) {
    return await Form.count({ isActive });
  }
}
