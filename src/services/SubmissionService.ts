import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface Submission {
  id: string;
  formId: string;
  data: any;
  status: 'pending' | 'processed' | 'failed';
  submittedBy?: string;
  submittedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubmissionRequest {
  formId: string;
  data: any;
  submittedBy?: string;
}

export interface UpdateSubmissionRequest {
  status?: 'pending' | 'processed' | 'failed';
  errorMessage?: string;
}

export class SubmissionService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createSubmission(request: CreateSubmissionRequest): Promise<Submission> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO submissions (form_id, data, status, submitted_by, submitted_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.formId,
        JSON.stringify(request.data),
        request.status || 'pending',
        request.submittedBy || null
      ]);

      logger.info('Submission created successfully', { submissionId: result.rows[0].id });
      return this.mapRowToSubmission(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getSubmissionById(id: string): Promise<Submission | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM submissions WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSubmission(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getSubmissionsByFormId(formId: string, limit: number = 50, offset: number = 0): Promise<Submission[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submissions 
        WHERE form_id = $1 
        ORDER BY submitted_at DESC 
        LIMIT $2 OFFSET $3
      `;
      const result = await client.query(query, [formId, limit, offset]);
      
      return result.rows.map(row => this.mapRowToSubmission(row));
    } finally {
      client.release();
    }
  }

  async getAllSubmissions(limit: number = 50, offset: number = 0): Promise<Submission[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submissions 
        ORDER BY submitted_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToSubmission(row));
    } finally {
      client.release();
    }
  }

  async updateSubmission(id: string, request: UpdateSubmissionRequest): Promise<Submission | null> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (request.status !== undefined) {
        fields.push(`status = $${paramIndex}`);
        values.push(request.status);
        paramIndex++;
      }

      if (request.errorMessage !== undefined) {
        fields.push(`error_message = $${paramIndex}`);
        values.push(request.errorMessage);
        paramIndex++;
      }

      if (fields.length > 0) {
        fields.push(`processed_at = ${request.status === 'processed' ? 'CURRENT_TIMESTAMP' : 'processed_at'}`);
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
      } else {
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
      }

      values.push(id);

      const query = `
        UPDATE submissions 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Submission updated successfully', { submissionId: id });
      return this.mapRowToSubmission(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteSubmission(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM submissions WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('Submission deleted successfully', { submissionId: id });
      }
      
      return deleted;
    } finally {
      client.release();
    }
  }

  async searchSubmissions(searchTerm: string, limit: number = 20): Promise<Submission[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submissions 
        WHERE to_tsvector('english', data::text) @@ to_tsquery('english', $1)
        ORDER BY ts_rank DESC
        LIMIT $2
      `;
      const result = await client.query(query, [searchTerm, limit]);
      
      return result.rows.map(row => this.mapRowToSubmission(row));
    } finally {
      client.release();
    }
  }

  async getSubmissionStats(formId?: string): Promise<{
    total: number;
    pending: number;
    processed: number;
    failed: number;
  }> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM submissions
      `;

      const params = [];
      if (formId) {
        query += ' WHERE form_id = $1';
        params.push(formId);
      }

      const result = await client.query(query, params);
      
      return {
        total: parseInt(result.rows[0].total),
        pending: parseInt(result.rows[0].pending),
        processed: parseInt(result.rows[0].processed),
        failed: parseInt(result.rows[0].failed)
      };
    } finally {
      client.release();
    }
  }

  private mapRowToSubmission(row: any): Submission {
    return {
      id: row.id,
      formId: row.form_id,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      status: row.status,
      submittedBy: row.submitted_by,
      submittedAt: new Date(row.submitted_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}