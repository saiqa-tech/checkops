import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface SubmissionHistory {
  id: string;
  submissionId: string;
  action: 'created' | 'updated' | 'deleted' | 'processed' | 'failed';
  oldData?: any;
  newData?: any;
  reason?: string;
  performedBy?: string;
  performedAt: Date;
  createdAt: Date;
}

export interface CreateSubmissionHistoryRequest {
  submissionId: string;
  action: SubmissionHistory['action'];
  oldData?: any;
  newData?: any;
  reason?: string;
  performedBy?: string;
}

export class SubmissionHistoryService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createHistoryEntry(request: CreateSubmissionHistoryRequest): Promise<SubmissionHistory> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO submission_history (
          submission_id, action, old_data, new_data, reason, performed_by, performed_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.submissionId,
        request.action,
        request.oldData ? JSON.stringify(request.oldData) : null,
        request.newData ? JSON.stringify(request.newData) : null,
        request.reason || null,
        request.performedBy || null
      ]);

      logger.debug('Submission history entry created', { 
        submissionId: request.submissionId, 
        action: request.action 
      });
      
      return this.mapRowToSubmissionHistory(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getHistoryBySubmissionId(
    submissionId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<SubmissionHistory[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submission_history 
        WHERE submission_id = $1 
        ORDER BY performed_at DESC 
        LIMIT $2 OFFSET $3
      `;
      const result = await client.query(query, [submissionId, limit, offset]);
      
      return result.rows.map(row => this.mapRowToSubmissionHistory(row));
    } finally {
      client.release();
    }
  }

  async getAllHistory(limit: number = 100, offset: number = 0): Promise<SubmissionHistory[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submission_history 
        ORDER BY performed_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToSubmissionHistory(row));
    } finally {
      client.release();
    }
  }

  async getHistoryByAction(
    action: SubmissionHistory['action'],
    limit: number = 50
  ): Promise<SubmissionHistory[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submission_history 
        WHERE action = $1 
        ORDER BY performed_at DESC 
        LIMIT $2
      `;
      const result = await client.query(query, [action, limit]);
      
      return result.rows.map(row => this.mapRowToSubmissionHistory(row));
    } finally {
      client.release();
    }
  }

  async searchHistory(searchTerm: string, limit: number = 20): Promise<SubmissionHistory[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM submission_history 
        WHERE 
          to_tsvector('english', reason) @@ to_tsquery('english', $1) OR
          to_tsvector('english', COALESCE(new_data::text, old_data::text, '')) @@ to_tsquery('english', $1)
        ORDER BY ts_rank DESC
        LIMIT $2
      `;
      const result = await client.query(query, [searchTerm, limit]);
      
      return result.rows.map(row => this.mapRowToSubmissionHistory(row));
    } finally {
      client.release();
    }
  }

  private mapRowToSubmissionHistory(row: any): SubmissionHistory {
    return {
      id: row.id,
      submissionId: row.submission_id,
      action: row.action,
      oldData: row.old_data ? JSON.parse(row.old_data) : undefined,
      newData: row.new_data ? JSON.parse(row.new_data) : undefined,
      reason: row.reason,
      performedBy: row.performed_by,
      performedAt: new Date(row.performed_at),
      createdAt: new Date(row.created_at)
    };
  }
}