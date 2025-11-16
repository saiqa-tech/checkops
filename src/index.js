import { initializeDatabase, closeDatabase, testConnection } from './config/database.js';
import { FormService } from './services/FormService.js';
import { QuestionService } from './services/QuestionService.js';
import { SubmissionService } from './services/SubmissionService.js';
import * as errors from './utils/errors.js';

export class CheckOps {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.formService = null;
    this.questionService = null;
    this.submissionService = null;
  }

  async initialize() {
    if (this.initialized) {
      throw new Error('CheckOps already initialized');
    }

    try {
      initializeDatabase(this.config);
      await testConnection();

      this.formService = new FormService();
      this.questionService = new QuestionService();
      this.submissionService = new SubmissionService();

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize CheckOps: ${error.message}`);
    }
  }

  async close() {
    if (!this.initialized) {
      return;
    }

    await closeDatabase();
    this.initialized = false;
    this.formService = null;
    this.questionService = null;
    this.submissionService = null;
  }

  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CheckOps not initialized. Call initialize() first.');
    }
  }

  async createForm({ title, description, questions, metadata }) {
    this.ensureInitialized();
    return await this.formService.createForm({ title, description, questions, metadata });
  }

  async getForm(id) {
    this.ensureInitialized();
    return await this.formService.getFormById(id);
  }

  async getAllForms(options) {
    this.ensureInitialized();
    return await this.formService.getAllForms(options);
  }

  async updateForm(id, updates) {
    this.ensureInitialized();
    return await this.formService.updateForm(id, updates);
  }

  async deleteForm(id) {
    this.ensureInitialized();
    return await this.formService.deleteForm(id);
  }

  async deactivateForm(id) {
    this.ensureInitialized();
    return await this.formService.deactivateForm(id);
  }

  async activateForm(id) {
    this.ensureInitialized();
    return await this.formService.activateForm(id);
  }

  async getFormCount(options) {
    this.ensureInitialized();
    return await this.formService.getFormCount(options);
  }

  async createQuestion({ questionText, questionType, options, validationRules, metadata }) {
    this.ensureInitialized();
    return await this.questionService.createQuestion({
      questionText,
      questionType,
      options,
      validationRules,
      metadata,
    });
  }

  async getQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.getQuestionById(id);
  }

  async getQuestions(ids) {
    this.ensureInitialized();
    return await this.questionService.getQuestionsByIds(ids);
  }

  async getAllQuestions(options) {
    this.ensureInitialized();
    return await this.questionService.getAllQuestions(options);
  }

  async updateQuestion(id, updates) {
    this.ensureInitialized();
    return await this.questionService.updateQuestion(id, updates);
  }

  async deleteQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.deleteQuestion(id);
  }

  async deactivateQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.deactivateQuestion(id);
  }

  async activateQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.activateQuestion(id);
  }

  async getQuestionCount(options) {
    this.ensureInitialized();
    return await this.questionService.getQuestionCount(options);
  }

  async createSubmission({ formId, submissionData, metadata }) {
    this.ensureInitialized();
    return await this.submissionService.createSubmission({ formId, submissionData, metadata });
  }

  async getSubmission(id) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionById(id);
  }

  async getSubmissionsByForm(formId, options) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionsByFormId(formId, options);
  }

  async getAllSubmissions(options) {
    this.ensureInitialized();
    return await this.submissionService.getAllSubmissions(options);
  }

  async updateSubmission(id, updates) {
    this.ensureInitialized();
    return await this.submissionService.updateSubmission(id, updates);
  }

  async deleteSubmission(id) {
    this.ensureInitialized();
    return await this.submissionService.deleteSubmission(id);
  }

  async getSubmissionCount(options) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionCount(options);
  }

  async getSubmissionStats(formId) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionStats(formId);
  }

  async updateOptionLabel(questionId, optionKey, newLabel, changedBy = null) {
    this.ensureInitialized();
    return await this.questionService.updateOptionLabel(questionId, optionKey, newLabel, changedBy);
  }

  async getOptionHistory(questionId, optionKey = null) {
    this.ensureInitialized();
    return await this.questionService.getOptionHistory(questionId, optionKey);
  }
}

export default CheckOps;

export {
  errors,
  FormService,
  QuestionService,
  SubmissionService,
};
