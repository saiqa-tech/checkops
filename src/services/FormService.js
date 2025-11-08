import { Form } from '../models/Form.js';
import { Question } from '../models/Question.js';
import { validateRequired, validateString, validateQuestions } from '../utils/validation.js';
import { sanitizeString, sanitizeObject } from '../utils/sanitization.js';

export class FormService {
  async createForm({ title, description = '', questions, metadata = {} }) {
    validateRequired(title, 'Title');
    validateString(title, 'Title', 1, 255);
    validateQuestions(questions);

    const sanitizedTitle = sanitizeString(title);
    const sanitizedDescription = sanitizeString(description);
    const sanitizedQuestions = sanitizeObject(questions);
    const sanitizedMetadata = sanitizeObject(metadata);

    const enrichedQuestions = await this.enrichQuestions(sanitizedQuestions);

    return await Form.create({
      title: sanitizedTitle,
      description: sanitizedDescription,
      questions: enrichedQuestions,
      metadata: sanitizedMetadata,
    });
  }

  async enrichQuestions(questions) {
    const enriched = [];

    for (const question of questions) {
      if (question.questionId) {
        try {
          const bankQuestion = await Question.findById(question.questionId);
          enriched.push({
            questionId: bankQuestion.id,
            questionText: question.questionText || bankQuestion.questionText,
            questionType: question.questionType || bankQuestion.questionType,
            options: question.options || bankQuestion.options,
            validationRules: question.validationRules || bankQuestion.validationRules,
            required: question.required || false,
            metadata: { ...bankQuestion.metadata, ...question.metadata },
          });
        } catch (error) {
          enriched.push(question);
        }
      } else {
        enriched.push(question);
      }
    }

    return enriched;
  }

  async getFormById(id) {
    validateRequired(id, 'Form ID');
    return await Form.findById(id);
  }

  async getAllForms({ isActive = null, limit = 100, offset = 0 } = {}) {
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

    return await Form.update(id, sanitizedUpdates);
  }

  async deleteForm(id) {
    validateRequired(id, 'Form ID');
    return await Form.delete(id);
  }

  async deactivateForm(id) {
    validateRequired(id, 'Form ID');
    return await Form.update(id, { isActive: false });
  }

  async activateForm(id) {
    validateRequired(id, 'Form ID');
    return await Form.update(id, { isActive: true });
  }

  async getFormCount({ isActive = null } = {}) {
    return await Form.count({ isActive });
  }
}
