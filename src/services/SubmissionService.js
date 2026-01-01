import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { Question } from '../models/Question.js';
import { validateRequired, validateSubmissionData } from '../utils/validation.js';
import { validateAndSanitizeSubmissionData } from '../utils/optimizedValidation.js';
import { sanitizeObject } from '../utils/sanitization.js';
import { OptionUtils } from '../utils/optionUtils.js';
import { getPool } from '../config/database.js';
import { checkOpsCache } from '../utils/cache.js';

export class SubmissionService {
  async createSubmission({ formId, submissionData, metadata = {} }) {
    validateRequired(formId, 'Form ID');
    validateRequired(submissionData, 'Submission data');

    const form = await Form.findById(formId);

    if (!form.isActive) {
      throw new Error('Cannot submit to an inactive form');
    }

    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    // PHASE 3.2: Use optimized validation pipeline
    const sanitizedSubmissionData = validateAndSanitizeSubmissionData(
      submissionData,
      questionsWithDetails
    );

    const sanitizedMetadata = sanitizeObject(metadata);

    const submission = await Submission.create({
      formId,
      submissionData: sanitizedSubmissionData,
      metadata: sanitizedMetadata,
    });

    // Invalidate stats cache since we have a new submission
    checkOpsCache.deleteStats(formId);

    return submission;
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

    // Check cache first
    const cachedStats = checkOpsCache.getStats(formId);
    if (cachedStats) {
      return cachedStats;
    }

    // OPTIMIZATION: Use database aggregation instead of loading all submissions into memory
    const pool = getPool();

    // Step 1: Get basic stats with single efficient query
    const basicStatsQuery = `
      SELECT 
        COUNT(*) as total_submissions,
        MIN(submitted_at) as first_submission,
        MAX(submitted_at) as last_submission
      FROM submissions
      WHERE form_id = $1
    `;

    const basicStatsResult = await pool.query(basicStatsQuery, [formId]);
    const basicStats = basicStatsResult.rows[0];

    // Step 2: Get form and question details (using our optimized enrichQuestions)
    const form = await Form.findById(formId);
    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    // Step 3: Build stats object with database aggregation
    const stats = {
      totalSubmissions: parseInt(basicStats.total_submissions, 10),
      firstSubmission: basicStats.first_submission,
      lastSubmission: basicStats.last_submission,
      questionStats: {},
    };

    // Step 4: Calculate stats per question using database aggregation
    for (const question of questionsWithDetails) {
      const questionId = question.questionId || question.id;
      stats.questionStats[questionId] = await this._getQuestionStatsFromDB(formId, questionId, question);
    }

    // Cache the results (3 minute TTL for stats)
    checkOpsCache.setStats(formId, stats, 180000);

    return stats;
  }

  async _getQuestionStatsFromDB(formId, questionId, question) {
    const pool = getPool();

    // OPTIMIZATION: Single query per question using PostgreSQL JSONB functions
    const query = `
      WITH question_answers AS (
        SELECT 
          submission_data->$2 as answer
        FROM submissions
        WHERE form_id = $1
      )
      SELECT 
        COUNT(*) as total_answers,
        COUNT(*) FILTER (WHERE answer IS NULL OR answer::text = 'null' OR answer::text = '""') as empty_answers,
        COUNT(DISTINCT answer) as unique_answer_count
      FROM question_answers
    `;

    const result = await pool.query(query, [formId, questionId]);
    const row = result.rows[0];

    const baseStats = {
      questionText: question.questionText,
      questionType: question.questionType,
      totalAnswers: parseInt(row.total_answers, 10) - parseInt(row.empty_answers, 10),
      emptyAnswers: parseInt(row.empty_answers, 10),
      uniqueAnswerCount: parseInt(row.unique_answer_count, 10),
    };

    // OPTIMIZATION: Only calculate distribution for questions with options
    if (question.options && OptionUtils.requiresOptions(question.questionType)) {
      baseStats.answerDistribution = await this._getAnswerDistributionFromDB(formId, questionId, question);
      baseStats._keyDistribution = await this._getKeyDistributionFromDB(formId, questionId, question);
    } else {
      // For non-option questions, get simple answer distribution
      baseStats.answerDistribution = await this._getSimpleAnswerDistributionFromDB(formId, questionId);
    }

    return baseStats;
  }

  async _getAnswerDistributionFromDB(formId, questionId, question) {
    const pool = getPool();

    // Use PostgreSQL's aggregation for option counting
    const query = `
      SELECT 
        submission_data->$2 as answer,
        COUNT(*) as count
      FROM submissions
      WHERE form_id = $1
        AND submission_data->$2 IS NOT NULL
        AND submission_data->$2::text != 'null'
        AND submission_data->$2::text != '""'
      GROUP BY submission_data->$2
    `;

    const result = await pool.query(query, [formId, questionId]);

    const distribution = {};

    result.rows.forEach(row => {
      const answer = row.answer;
      const count = parseInt(row.count, 10);

      if (Array.isArray(answer)) {
        // Handle multi-select answers
        answer.forEach(key => {
          const option = question.options.find(opt => opt.key === key);
          const label = option ? option.label : key;
          distribution[label] = (distribution[label] || 0) + count;
        });
      } else {
        // Handle single-select answers
        const option = question.options.find(opt => opt.key === answer);
        const label = option ? option.label : answer;
        distribution[label] = (distribution[label] || 0) + count;
      }
    });

    return distribution;
  }

  async _getKeyDistributionFromDB(formId, questionId, question) {
    const pool = getPool();

    const query = `
      SELECT 
        submission_data->$2 as answer,
        COUNT(*) as count
      FROM submissions
      WHERE form_id = $1
        AND submission_data->$2 IS NOT NULL
        AND submission_data->$2::text != 'null'
        AND submission_data->$2::text != '""'
      GROUP BY submission_data->$2
    `;

    const result = await pool.query(query, [formId, questionId]);

    const keyDistribution = {};

    result.rows.forEach(row => {
      const answer = row.answer;
      const count = parseInt(row.count, 10);

      if (Array.isArray(answer)) {
        answer.forEach(key => {
          keyDistribution[key] = (keyDistribution[key] || 0) + count;
        });
      } else {
        keyDistribution[answer] = (keyDistribution[answer] || 0) + count;
      }
    });

    return keyDistribution;
  }

  async _getSimpleAnswerDistributionFromDB(formId, questionId) {
    const pool = getPool();

    const query = `
      SELECT 
        CASE 
          WHEN jsonb_typeof(submission_data->$2) = 'array' THEN
            array_to_string(ARRAY(SELECT jsonb_array_elements_text(submission_data->$2)), ', ')
          ELSE
            submission_data->>$2
        END as answer_text,
        COUNT(*) as count
      FROM submissions
      WHERE form_id = $1
        AND submission_data->$2 IS NOT NULL
        AND submission_data->$2::text != 'null'
        AND submission_data->$2::text != '""'
      GROUP BY answer_text
    `;

    const result = await pool.query(query, [formId, questionId]);

    const distribution = {};
    result.rows.forEach(row => {
      distribution[row.answer_text] = parseInt(row.count, 10);
    });

    return distribution;
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
