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
    // NEW: Normalize questions to simple string array format
    // Convert any object format to string UUID
    const normalizedQuestions = questions.map(q => {
      if (typeof q === 'string') {
        return q; // Already in simple format
      }
      if (q.questionId) {
        return q.questionId; // Extract UUID from object
      }
      // If it's an inline question (has questionText), keep as object
      if (q.questionText) {
        return q;
      }
      throw new Error('Invalid question format');
    });

    // OPTIMIZATION: Fix N+1 query problem by batching question lookups
    // Step 1: Collect all unique question UUIDs that need enrichment
    const questionIds = [...new Set(
      normalizedQuestions.filter(q => typeof q === 'string')
    )];

    // Early return if no questions need enrichment
    if (questionIds.length === 0) {
      return normalizedQuestions;
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

    // Step 3: Return simple string array (UUIDs only)
    // The enrichment is done at retrieval time, not storage time
    return normalizedQuestions;
  }

  /**
   * Get form by UUID (internal use)
   * @param {string} uuid - Form UUID
   * @returns {Promise<Form>}
   */
  async getFormById(uuid) {
    validateRequired(uuid, 'Form UUID');

    // Try cache first (cache by UUID for internal operations)
    const cached = checkOpsCache.getForm(uuid);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const form = await Form.findById(uuid);

    // Cache the result
    checkOpsCache.setForm(uuid, form);

    return form;
  }

  async getAllForms({ isActive = null, limit = 100, offset = 0 } = {}) {
    // Note: We don't cache list operations as they can vary by parameters
    // and would require more complex cache invalidation logic
    return await Form.findAll({ isActive, limit, offset });
  }

  /**
   * Update form by UUID (internal use)
   * @param {string} uuid - Form UUID
   * @param {object} updates - Updates to apply
   * @returns {Promise<Form>}
   */
  async updateFormById(uuid, updates) {
    validateRequired(uuid, 'Form UUID');

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

    const updatedForm = await Form.updateById(uuid, sanitizedUpdates);

    // Invalidate cache for this form (by both UUID and SID)
    checkOpsCache.invalidateForm(uuid);
    checkOpsCache.invalidateForm(updatedForm.sid);

    return updatedForm;
  }

  /**
   * Delete form by UUID (internal use)
   * @param {string} uuid - Form UUID
   * @returns {Promise<Form>}
   */
  async deleteFormById(uuid) {
    validateRequired(uuid, 'Form UUID');

    const result = await Form.deleteById(uuid);

    // Invalidate cache for this form (by both UUID and SID)
    checkOpsCache.invalidateForm(uuid);
    checkOpsCache.invalidateForm(result.sid);

    return result;
  }

  /**
   * Deactivate form by UUID (internal use)
   * @param {string} uuid - Form UUID
   * @returns {Promise<Form>}
   */
  async deactivateFormById(uuid) {
    validateRequired(uuid, 'Form UUID');

    const result = await Form.updateById(uuid, { isActive: false });

    // Invalidate cache for this form
    checkOpsCache.invalidateForm(uuid);
    checkOpsCache.invalidateForm(result.sid);

    return result;
  }

  /**
   * Activate form by UUID (internal use)
   * @param {string} uuid - Form UUID
   * @returns {Promise<Form>}
   */
  async activateFormById(uuid) {
    validateRequired(uuid, 'Form UUID');

    const result = await Form.updateById(uuid, { isActive: true });

    // Invalidate cache for this form
    checkOpsCache.invalidateForm(uuid);
    checkOpsCache.invalidateForm(result.sid);

    return result;
  }

  async getFormCount({ isActive = null } = {}) {
    return await Form.count({ isActive });
  }
}
