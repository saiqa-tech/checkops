import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { CounterModel } from './Counter.js';
import type { SubmissionPayload } from '../../types.js';

export interface SubmissionRow {
  id: string;
  formId: string;
  version: string;
  submissionId: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  source?: string;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  status: 'pending' | 'processed' | 'failed' | 'archived';
  processedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionStats {
  total: number;
  pending: number;
  processed: number;
  failed: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

export class SubmissionModel {
  private db = getDatabase();
  private counterModel = new CounterModel();

  async createSubmission(
    formId: string,
    payload: SubmissionPayload,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SubmissionRow> {
    const query = `
      INSERT INTO submissions (
        form_id, version, submission_id, data, metadata, 
        source, submitted_at, ip_address, user_agent, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    try {
      const submissionId = await this.counterModel.getNextValue(`submissions_${formId}`);
      const submissionIdString = `${formId}_${submissionId}`;
      
      const result = await this.db.queryOne<SubmissionRow>(query, [
        formId,
        payload.version || '1.0.0',
        submissionIdString,
        payload.data,
        payload.metadata,
        payload.source,
        payload.submittedAt,
        ipAddress,
        userAgent,
        'pending'
      ]);

      if (!result) {
        throw new Error('Failed to create submission');
      }

      logger.info(`Created submission: ${result.id} for form: ${formId}`);
      return result;
    } catch (error) {
      logger.error(`Failed to create submission for form: ${formId}`, error);
      throw error;
    }
  }

  async getSubmission(submissionId: string): Promise<SubmissionRow | null> {
    const query = `
      SELECT * FROM submissions WHERE id = $1
    `;

    try {
      const result = await this.db.queryOne<SubmissionRow>(query, [submissionId]);
      return result;
    } catch (error) {
      logger.error(`Failed to get submission: ${submissionId}`, error);
      throw error;
    }
  }

  async getSubmissionBySubmissionId(submissionId: string): Promise<SubmissionRow | null> {
    const query = `
      SELECT * FROM submissions WHERE submission_id = $1
    `;

    try {
      const result = await this.db.queryOne<SubmissionRow>(query, [submissionId]);
      return result;
    } catch (error) {
      logger.error(`Failed to get submission by submission_id: ${submissionId}`, error);
      throw error;
    }
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: SubmissionRow['status'],
    error?: string
  ): Promise<SubmissionRow> {
    const query = `
      UPDATE submissions 
      SET status = $2, error = $3, updated_at = CURRENT_TIMESTAMP,
          processed_at = CASE 
            WHEN $2 IN ('processed', 'failed') THEN CURRENT_TIMESTAMP 
            ELSE processed_at 
          END
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.db.queryOne<SubmissionRow>(query, [submissionId, status, error]);
      
      if (!result) {
        throw new Error(`Submission with id '${submissionId}' not found`);
      }

      logger.info(`Updated submission status: ${submissionId} to ${status}`);
      return result;
    } catch (error) {
      logger.error(`Failed to update submission status: ${submissionId}`, error);
      throw error;
    }
  }

  async listSubmissions(
    formId?: string,
    status?: SubmissionRow['status'],
    limit: number = 50,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date
  ): Promise<SubmissionRow[]> {
    let query = `
      SELECT * FROM submissions
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (formId) {
      conditions.push(`form_id = $${paramIndex}`);
      params.push(formId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`submitted_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`submitted_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    try {
      const submissions = await this.db.query<SubmissionRow>(query, params);
      return submissions;
    } catch (error) {
      logger.error('Failed to list submissions', error);
      throw error;
    }
  }

  async getSubmissionStats(formId?: string): Promise<SubmissionStats> {
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (formId) {
      whereClause = `WHERE form_id = $1`;
      params.push(formId);
      paramIndex++;
    }

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN DATE(submitted_at) = CURRENT_DATE THEN 1 END) as today,
        COUNT(CASE WHEN submitted_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as this_week,
        COUNT(CASE WHEN submitted_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month
      FROM submissions 
      ${whereClause}
    `;

    try {
      const result = await this.db.queryOne<{
        total: string;
        pending: string;
        processed: string;
        failed: string;
        today: string;
        this_week: string;
        this_month: string;
      }>(query, params);

      if (!result) {
        return {
          total: 0,
          pending: 0,
          processed: 0,
          failed: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0
        };
      }

      return {
        total: parseInt(result.total),
        pending: parseInt(result.pending),
        processed: parseInt(result.processed),
        failed: parseInt(result.failed),
        today: parseInt(result.today),
        thisWeek: parseInt(result.this_week),
        thisMonth: parseInt(result.this_month)
      };
    } catch (error) {
      logger.error('Failed to get submission stats', error);
      throw error;
    }
  }

  async searchSubmissions(
    searchTerm: string,
    formId?: string,
    limit: number = 20
  ): Promise<SubmissionRow[]> {
    let query = `
      SELECT * FROM submissions 
      WHERE to_tsvector('english', data::text) @@ to_tsquery('english', $1)
    `;
    const params = [searchTerm];
    let paramIndex = 2;

    if (formId) {
      query += ` AND form_id = $${paramIndex}`;
      params.push(formId);
      paramIndex++;
    }

    query += ` ORDER BY submitted_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const submissions = await this.db.query<SubmissionRow>(query, params);
      return submissions;
    } catch (error) {
      logger.error(`Failed to search submissions with term: ${searchTerm}`, error);
      throw error;
    }
  }

  async deleteSubmission(submissionId: string): Promise<void> {
    const query = `DELETE FROM submissions WHERE id = $1`;

    try {
      const result = await this.db.query(query, [submissionId]);
      
      if (result.length === 0) {
        throw new Error(`Submission with id '${submissionId}' not found`);
      }

      logger.info(`Deleted submission: ${submissionId}`);
    } catch (error) {
      logger.error(`Failed to delete submission: ${submissionId}`, error);
      throw error;
    }
  }

  async archiveSubmissions(olderThanDays: number = 365): Promise<number> {
    const query = `
      UPDATE submissions 
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE submitted_at < NOW() - INTERVAL '${olderThanDays} days'
      AND status != 'archived'
      RETURNING id
    `;

    try {
      const results = await this.db.query<{ id: string }>(query);
      logger.info(`Archived ${results.length} submissions older than ${olderThanDays} days`);
      return results.length;
    } catch (error) {
      logger.error(`Failed to archive submissions older than ${olderThanDays} days`, error);
      throw error;
    }
  }

  async getRecentSubmissions(
    formId: string,
    hours: number = 24,
    limit: number = 10
  ): Promise<SubmissionRow[]> {
    const query = `
      SELECT * FROM submissions 
      WHERE form_id = $1 AND submitted_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY submitted_at DESC
      LIMIT $2
    `;

    try {
      const submissions = await this.db.query<SubmissionRow>(query, [formId, limit]);
      return submissions;
    } catch (error) {
      logger.error(`Failed to get recent submissions for form: ${formId}`, error);
      throw error;
    }
  }
}