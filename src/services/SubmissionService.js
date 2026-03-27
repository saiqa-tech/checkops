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
  /**
   * Create submission (accepts formId UUID)
   * @param {object} params
   * @param {string} params.formId - Form UUID
   * @param {object} params.submissionData - Submission data
   * @param {object} params.metadata - Metadata
   * @returns {Promise<Submission>}
   */
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
    checkOpsCache.deleteStats(form.id);
    checkOpsCache.deleteStats(form.sid);

    return submission;
  }

  /**
   * Get submission by UUID (internal use)
   * @param {string} uuid - Submission UUID
   * @returns {Promise<Submission>}
   */
  async getSubmissionById(uuid) {
    validateRequired(uuid, 'Submission UUID');
    const submission = await Submission.findById(uuid);

    const form = await Form.findById(submission.formId);
    const questionsWithDetails = await this._getQuestionsWithDetails(form.questions);

    const displayData = this._transformKeysToLabels(submission.submissionData, questionsWithDetails);

    return {
      ...submission,
      submissionData: displayData,
      _rawData: submission.submissionData,
    };
  }

  /**
   * Get submissions by form UUID (internal use)
   * @param {string} formUuid - Form UUID
   * @param {object} options - Pagination options
   * @returns {Promise<Array<Submission>>}
   */
  async getSubmissionsByFormId(formUuid, { limit = 100, offset = 0 } = {}) {
    validateRequired(formUuid, 'Form UUID');
    const submissions = await Submission.findByFormId(formUuid, { limit, offset });

    const form = await Form.findById(formUuid);
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

  /**
   * Update submission by UUID (internal use)
   * @param {string} uuid - Submission UUID
   * @param {object} updates - Updates to apply
   * @returns {Promise<Submission>}
   */
  async updateSubmissionById(uuid, updates) {
    validateRequired(uuid, 'Submission UUID');

    const submission = await Submission.findById(uuid);

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

    return await Submission.updateById(uuid, sanitizedUpdates);
  }

  /**
   * Delete submission by UUID (internal use)
   * @param {string} uuid - Submission UUID
   * @returns {Promise<Submission>}
   */
  async deleteSubmissionById(uuid) {
    validateRequired(uuid, 'Submission UUID');
    return await Submission.deleteById(uuid);
  }

  /**
   * Get submission count
   * @param {object} options
   * @param {string} options.formId - Form UUID (optional)
   * @returns {Promise<number>}
   */
  async getSubmissionCount({ formId = null } = {}) {
    return await Submission.count({ formId });
  }

  /**
   * Get submission stats by form UUID (internal use)
   * @param {string} formUuid - Form UUID
   * @returns {Promise<object>}
   */
  async getSubmissionStatsById(formUuid) {
    validateRequired(formUuid, 'Form UUID');

    // Check cache first
    const cachedStats = checkOpsCache.getStats(formUuid);
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

    const basicStatsResult = await pool.query(basicStatsQuery, [formUuid]);
    const basicStats = basicStatsResult.rows[0];

    // Step 2: Get form and question details (using our optimized enrichQuestions)
    const form = await Form.findById(formUuid);
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
      const questionId = question.questionId || question.sid;
      stats.questionStats[questionId] = await this._getQuestionStatsFromDB(formUuid, questionId, question);
    }

    // Cache the results (3 minute TTL for stats)
    checkOpsCache.setStats(formUuid, stats, 180000);
    checkOpsCache.setStats(form.sid, stats, 180000);

    return stats;
  }

  async _getQuestionStatsFromDB(formUuid, questionId, question) {
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

    const result = await pool.query(query, [formUuid, questionId]);
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
      baseStats.answerDistribution = await this._getAnswerDistributionFromDB(formUuid, questionId, question);
      baseStats._keyDistribution = await this._getKeyDistributionFromDB(formUuid, questionId, question);
    } else {
      // For non-option questions, get simple answer distribution
      baseStats.answerDistribution = await this._getSimpleAnswerDistributionFromDB(formUuid, questionId);
    }

    return baseStats;
  }

  async _getAnswerDistributionFromDB(formUuid, questionId, question) {
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

    const result = await pool.query(query, [formUuid, questionId]);

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

  async _getKeyDistributionFromDB(formUuid, questionId, question) {
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

    const result = await pool.query(query, [formUuid, questionId]);

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

  async _getSimpleAnswerDistributionFromDB(formUuid, questionId) {
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

    const result = await pool.query(query, [formUuid, questionId]);

    const distribution = {};
    result.rows.forEach(row => {
      distribution[row.answer_text] = parseInt(row.count, 10);
    });

    return distribution;
  }

  async _getQuestionsWithDetails(formQuestions) {
    // NEW: Handle simple string array format
    const questionIds = formQuestions
      .filter((q) => typeof q === 'string') // Simple string UUIDs
      .map((q) => q);

    // Also handle old object format for backward compatibility during transition
    const objectQuestionIds = formQuestions
      .filter((q) => typeof q === 'object' && q.questionId)
      .map((q) => q.questionId);

    const allQuestionIds = [...questionIds, ...objectQuestionIds];

    if (allQuestionIds.length === 0) {
      return formQuestions;
    }

    // Use findByIds since questionId contains UUIDs
    const questionDetails = await Question.findByIds(allQuestionIds);
    const questionMap = new Map(questionDetails.map((q) => [q.id, q]));

    return formQuestions.map((q) => {
      // Handle simple string format
      if (typeof q === 'string') {
        const details = questionMap.get(q);
        return details ? details.toJSON() : null;
      }

      // Handle old object format
      if (q.questionId) {
        const details = questionMap.get(q.questionId);
        return details ? { ...q, ...details.toJSON(), questionId: q.questionId } : q;
      }

      return q;
    }).filter(Boolean); // Remove nulls
  }

  _transformSubmissionToKeys(submissionData, questions) {
    const transformed = { ...submissionData };

    questions.forEach((question) => {
      // Try multiple possible keys: UUID (id), SID (sid), or questionId
      const possibleKeys = [
        question.id,           // UUID from question bank
        question.sid,          // SID from question bank
        question.questionId    // Reference from form.questions array
      ].filter(Boolean);

      for (const questionKey of possibleKeys) {
        const answer = transformed[questionKey];

        if (answer !== undefined && answer !== null && answer !== '') {
          if (question.options && OptionUtils.requiresOptions(question.questionType)) {
            transformed[questionKey] = OptionUtils.convertToKeys(answer, question.options);
          }
        }
      }
    });

    return transformed;
  }

  _transformKeysToLabels(submissionData, questions) {
    const transformed = { ...submissionData };

    questions.forEach((question) => {
      // Try multiple possible keys: UUID (id), SID (sid), or questionId
      const possibleKeys = [
        question.id,           // UUID from question bank
        question.sid,          // SID from question bank
        question.questionId    // Reference from form.questions array
      ].filter(Boolean);

      for (const questionKey of possibleKeys) {
        const answer = transformed[questionKey];

        if (answer !== undefined && answer !== null && answer !== '') {
          if (question.options && OptionUtils.requiresOptions(question.questionType)) {
            transformed[questionKey] = OptionUtils.convertToLabels(answer, question.options);
          }
        }
      }
    });

    return transformed;
  }
}
