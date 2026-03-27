import { initializeDatabase, closeDatabase, testConnection } from './config/database.js';
import { FormService } from './services/FormService.js';
import { QuestionService } from './services/QuestionService.js';
import { SubmissionService } from './services/SubmissionService.js';
import { FindingService } from './services/FindingService.js';
import * as errors from './utils/errors.js';
import { metricsCollector, performanceMonitor } from './utils/metrics.js';
import { productionMetrics, metricsMiddleware, getHealthCheckData } from './utils/productionMetrics.js';
import { withMonitoring, withModelMonitoring, recordBatchOperation } from './utils/monitoringWrapper.js';
import { checkOpsCache } from './utils/cache.js';

export class CheckOps {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.formService = null;
    this.questionService = null;
    this.submissionService = null;
    this.findingService = null;
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
      this.findingService = new FindingService();

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
    this.findingService = null;
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
    return await this.formService.updateFormById(id, updates);
  }

  async deleteForm(id) {
    this.ensureInitialized();
    return await this.formService.deleteFormById(id);
  }

  async deactivateForm(id) {
    this.ensureInitialized();
    return await this.formService.deactivateFormById(id);
  }

  async activateForm(id) {
    this.ensureInitialized();
    return await this.formService.activateFormById(id);
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
    return await this.questionService.updateQuestionById(id, updates);
  }

  async deleteQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.deleteQuestionById(id);
  }

  async deactivateQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.deactivateQuestionById(id);
  }

  async activateQuestion(id) {
    this.ensureInitialized();
    return await this.questionService.activateQuestionById(id);
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
    return await this.submissionService.updateSubmissionById(id, updates);
  }

  async deleteSubmission(id) {
    this.ensureInitialized();
    return await this.submissionService.deleteSubmissionById(id);
  }

  async getSubmissionCount(options) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionCount(options);
  }

  async getSubmissionStats(formId) {
    this.ensureInitialized();
    return await this.submissionService.getSubmissionStatsById(formId);
  }

  // Finding methods
  async createFinding(params) {
    this.ensureInitialized();
    return await this.findingService.createFinding(params);
  }

  async getFinding(id) {
    this.ensureInitialized();
    return await this.findingService.getFindingById(id);
  }

  async getFindingsByForm(formId, options) {
    this.ensureInitialized();
    return await this.findingService.getFindingsByFormId(formId, options);
  }

  async getFindingsBySubmission(submissionId) {
    this.ensureInitialized();
    return await this.findingService.getFindingsBySubmissionId(submissionId);
  }

  async getFindingsByQuestion(questionId, options) {
    this.ensureInitialized();
    return await this.findingService.getFindingsByQuestionId(questionId, options);
  }

  async getFindings(filters) {
    this.ensureInitialized();
    return await this.findingService.getFindings(filters);
  }

  async updateFinding(id, updates) {
    this.ensureInitialized();
    return await this.findingService.updateFindingById(id, updates);
  }

  async deleteFinding(id) {
    this.ensureInitialized();
    return await this.findingService.deleteFindingById(id);
  }

  async getFindingCount(filters) {
    this.ensureInitialized();
    return await this.findingService.getFindingCount(filters);
  }

  async getFindingsStats(formId) {
    this.ensureInitialized();
    return await this.findingService.getFindingsStats(formId);
  }

  async updateOptionLabel(questionId, optionKey, newLabel, changedBy = null) {
    this.ensureInitialized();
    return await this.questionService.updateOptionLabelById(questionId, optionKey, newLabel, changedBy);
  }

  async getOptionHistory(questionId, optionKey = null) {
    this.ensureInitialized();
    return await this.questionService.getOptionHistoryById(questionId, optionKey);
  }

  // Cache management methods for v3.0.0 MCP server
  getCacheStats() {
    this.ensureInitialized();
    return checkOpsCache.getCacheStats();
  }

  async clearCache(type = 'all', id = null) {
    this.ensureInitialized();

    if (type === 'all') {
      checkOpsCache.clear();
      return { message: 'All caches cleared successfully' };
    }

    // Clear specific cache types
    switch (type) {
      case 'form':
        if (id) {
          checkOpsCache.formCache.delete(id);
          return { message: `Form cache cleared for ID: ${id}` };
        } else {
          checkOpsCache.formCache.clear();
          return { message: 'All form caches cleared' };
        }
      case 'question':
        if (id) {
          checkOpsCache.questionCache.delete(id);
          return { message: `Question cache cleared for ID: ${id}` };
        } else {
          checkOpsCache.questionCache.clear();
          return { message: 'All question caches cleared' };
        }
      case 'stats':
        if (id) {
          checkOpsCache.statsCache.delete(id);
          return { message: `Stats cache cleared for ID: ${id}` };
        } else {
          checkOpsCache.statsCache.clear();
          return { message: 'All stats caches cleared' };
        }
      case 'submission':
        if (id) {
          checkOpsCache.submissionCache.delete(id);
          return { message: `Submission cache cleared for ID: ${id}` };
        } else {
          checkOpsCache.submissionCache.clear();
          return { message: 'All submission caches cleared' };
        }
      default:
        throw new Error(`Unknown cache type: ${type}`);
    }
  }
}

export default CheckOps;

export {
  errors,
  FormService,
  QuestionService,
  SubmissionService,
  FindingService,
  // Phase 4: Performance Monitoring & Testing
  metricsCollector,
  performanceMonitor,
  productionMetrics,
  metricsMiddleware,
  getHealthCheckData,
  withMonitoring,
  withModelMonitoring,
  recordBatchOperation,
};
