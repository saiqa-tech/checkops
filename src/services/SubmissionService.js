import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { validateRequired, validateSubmissionData } from '../utils/validation.js';
import { sanitizeObject } from '../utils/sanitization.js';

export class SubmissionService {
  async createSubmission({ formId, submissionData, metadata = {} }) {
    validateRequired(formId, 'Form ID');
    validateRequired(submissionData, 'Submission data');

    const form = await Form.findById(formId);

    if (!form.isActive) {
      throw new Error('Cannot submit to an inactive form');
    }

    validateSubmissionData(submissionData, form.questions);

    const sanitizedSubmissionData = sanitizeObject(submissionData);
    const sanitizedMetadata = sanitizeObject(metadata);

    return await Submission.create({
      formId,
      submissionData: sanitizedSubmissionData,
      metadata: sanitizedMetadata,
    });
  }

  async getSubmissionById(id) {
    validateRequired(id, 'Submission ID');
    return await Submission.findById(id);
  }

  async getSubmissionsByFormId(formId, { limit = 100, offset = 0 } = {}) {
    validateRequired(formId, 'Form ID');
    return await Submission.findByFormId(formId, { limit, offset });
  }

  async getAllSubmissions({ limit = 100, offset = 0 } = {}) {
    return await Submission.findAll({ limit, offset });
  }

  async updateSubmission(id, updates) {
    validateRequired(id, 'Submission ID');

    const submission = await Submission.findById(id);

    const sanitizedUpdates = {};

    if (updates.submissionData !== undefined) {
      const form = await Form.findById(submission.formId);
      validateSubmissionData(updates.submissionData, form.questions);
      sanitizedUpdates.submissionData = sanitizeObject(updates.submissionData);
    }

    if (updates.metadata !== undefined) {
      sanitizedUpdates.metadata = sanitizeObject(updates.metadata);
    }

    return await Submission.update(id, sanitizedUpdates);
  }

  async deleteSubmission(id) {
    validateRequired(id, 'Submission ID');
    return await Submission.delete(id);
  }

  async getSubmissionCount({ formId = null } = {}) {
    return await Submission.count({ formId });
  }

  async getSubmissionStats(formId) {
    validateRequired(formId, 'Form ID');

    const submissions = await Submission.findByFormId(formId, { limit: 10000 });
    const form = await Form.findById(formId);

    const stats = {
      totalSubmissions: submissions.length,
      questionStats: {},
    };

    form.questions.forEach((question) => {
      const questionId = question.questionId || question.id;
      stats.questionStats[questionId] = {
        questionText: question.questionText,
        questionType: question.questionType,
        totalAnswers: 0,
        emptyAnswers: 0,
        uniqueAnswers: new Set(),
        answerFrequency: {},
      };
    });

    submissions.forEach((submission) => {
      form.questions.forEach((question) => {
        const questionId = question.questionId || question.id;
        const answer = submission.submissionData[questionId];

        const stat = stats.questionStats[questionId];

        if (answer !== undefined && answer !== null && answer !== '') {
          stat.totalAnswers++;
          stat.uniqueAnswers.add(JSON.stringify(answer));

          const answerKey = Array.isArray(answer) ? answer.join(', ') : String(answer);
          stat.answerFrequency[answerKey] = (stat.answerFrequency[answerKey] || 0) + 1;
        } else {
          stat.emptyAnswers++;
        }
      });
    });

    Object.keys(stats.questionStats).forEach((questionId) => {
      const stat = stats.questionStats[questionId];
      stat.uniqueAnswerCount = stat.uniqueAnswers.size;
      delete stat.uniqueAnswers;
    });

    return stats;
  }
}
