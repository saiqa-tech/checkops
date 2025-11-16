import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { Question } from '../models/Question.js';
import { validateRequired, validateSubmissionData } from '../utils/validation.js';
import { sanitizeObject } from '../utils/sanitization.js';
import { OptionUtils } from '../utils/optionUtils.js';

export class SubmissionService {
  async createSubmission({ formId, submissionData, metadata = {} }) {
    validateRequired(formId, 'Form ID');
    validateRequired(submissionData, 'Submission data');

    const form = await Form.findById(formId);

    if (!form.isActive) {
      throw new Error('Cannot submit to an inactive form');
    }

    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    const transformedData = this._transformSubmissionToKeys(submissionData, questionsWithDetails);

    validateSubmissionData(transformedData, questionsWithDetails);

    const sanitizedSubmissionData = sanitizeObject(transformedData);
    const sanitizedMetadata = sanitizeObject(metadata);

    return await Submission.create({
      formId,
      submissionData: sanitizedSubmissionData,
      metadata: sanitizedMetadata,
    });
  }

  async getSubmissionById(id) {
    validateRequired(id, 'Submission ID');
    const submission = await Submission.findById(id);

    const form = await Form.findById(submission.formId);
    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    const displayData = this._transformKeysToLabels(submission.submissionData, questionsWithDetails);

    return {
      ...submission,
      submissionData: displayData,
      _rawData: submission.submissionData,
    };
  }

  async getSubmissionsByFormId(formId, { limit = 100, offset = 0 } = {}) {
    validateRequired(formId, 'Form ID');
    const submissions = await Submission.findByFormId(formId, { limit, offset });

    const form = await Form.findById(formId);
    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    return submissions.map((submission) => {
      const displayData = this._transformKeysToLabels(submission.submissionData, questionsWithDetails);
      return {
        ...submission,
        submissionData: displayData,
        _rawData: submission.submissionData,
      };
    });
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
      const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

      const transformedData = this._transformSubmissionToKeys(updates.submissionData, questionsWithDetails);
      validateSubmissionData(transformedData, questionsWithDetails);
      sanitizedUpdates.submissionData = sanitizeObject(transformedData);
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
    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    const stats = {
      totalSubmissions: submissions.length,
      questionStats: {},
    };

    questionsWithDetails.forEach((question) => {
      const questionId = question.questionId || question.id;
      stats.questionStats[questionId] = {
        questionText: question.questionText,
        questionType: question.questionType,
        totalAnswers: 0,
        emptyAnswers: 0,
        uniqueAnswers: new Set(),
        answerDistribution: {},
        _keyDistribution: {},
      };
    });

    submissions.forEach((submission) => {
      questionsWithDetails.forEach((question) => {
        const questionId = question.questionId || question.id;
        const answer = submission.submissionData[questionId];

        const stat = stats.questionStats[questionId];

        if (answer !== undefined && answer !== null && answer !== '') {
          stat.totalAnswers++;
          stat.uniqueAnswers.add(JSON.stringify(answer));

          if (question.options && OptionUtils.requiresOptions(question.questionType)) {
            if (Array.isArray(answer)) {
              answer.forEach((key) => {
                const option = question.options.find((opt) => opt.key === key);
                const label = option ? option.label : key;
                stat.answerDistribution[label] = (stat.answerDistribution[label] || 0) + 1;
                stat._keyDistribution[key] = (stat._keyDistribution[key] || 0) + 1;
              });
            } else {
              const option = question.options.find((opt) => opt.key === answer);
              const label = option ? option.label : answer;
              stat.answerDistribution[label] = (stat.answerDistribution[label] || 0) + 1;
              stat._keyDistribution[answer] = (stat._keyDistribution[answer] || 0) + 1;
            }
          } else {
            const answerKey = Array.isArray(answer) ? answer.join(', ') : String(answer);
            stat.answerDistribution[answerKey] = (stat.answerDistribution[answerKey] || 0) + 1;
          }
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

  async _getQuestionsWithDetails(formQuestions) {
    const questionIds = formQuestions
      .filter((q) => q.questionId)
      .map((q) => q.questionId);

    if (questionIds.length === 0) {
      return formQuestions;
    }

    const questionDetails = await Question.findByIds(questionIds);
    const questionMap = new Map(questionDetails.map((q) => [q.id, q]));

    return formQuestions.map((q) => {
      if (q.questionId) {
        const details = questionMap.get(q.questionId);
        return details ? { ...q, ...details.toJSON(), questionId: q.questionId } : q;
      }
      return q;
    });
  }

  _transformSubmissionToKeys(submissionData, questions) {
    const transformed = { ...submissionData };

    questions.forEach((question) => {
      const questionId = question.questionId || question.id;
      const answer = transformed[questionId];

      if (answer !== undefined && answer !== null && answer !== '') {
        if (question.options && OptionUtils.requiresOptions(question.questionType)) {
          transformed[questionId] = OptionUtils.convertToKeys(answer, question.options);
        }
      }
    });

    return transformed;
  }

  _transformKeysToLabels(submissionData, questions) {
    const transformed = { ...submissionData };

    questions.forEach((question) => {
      const questionId = question.questionId || question.id;
      const answer = transformed[questionId];

      if (answer !== undefined && answer !== null && answer !== '') {
        if (question.options && OptionUtils.requiresOptions(question.questionType)) {
          transformed[questionId] = OptionUtils.convertToLabels(answer, question.options);
        }
      }
    });

    return transformed;
  }
}
