import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface Form {
  id: string;
  title: string;
  description?: string;
  schema: any;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  schema: any;
  createdBy: string;
}

export interface UpdateFormRequest {
  title?: string;
  description?: string;
  schema?: any;
  status?: 'active' | 'inactive';
}

export class FormService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createForm(request: CreateFormRequest): Promise<Form> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO forms (title, description, schema, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.title,
        request.description || null,
        JSON.stringify(request.schema),
        request.status || 'active',
        request.createdBy
      ]);

      logger.info('Form created successfully', { formId: result.rows[0].id });
      return this.mapRowToForm(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getFormById(id: string): Promise<Form | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM forms WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToForm(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getAllForms(limit: number = 50, offset: number = 0): Promise<Form[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM forms 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToForm(row));
    } finally {
      client.release();
    }
  }

  async updateForm(id: string, request: UpdateFormRequest): Promise<Form | null> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (request.title !== undefined) {
        fields.push(`title = $${paramIndex}`);
        values.push(request.title);
        paramIndex++;
      }

      if (request.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        values.push(request.description);
        paramIndex++;
      }

      if (request.schema !== undefined) {
        fields.push(`schema = $${paramIndex}`);
        values.push(JSON.stringify(request.schema));
        paramIndex++;
      }

      if (request.status !== undefined) {
        fields.push(`status = $${paramIndex}`);
        values.push(request.status);
        paramIndex++;
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE forms 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Form updated successfully', { formId: id });
      return this.mapRowToForm(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteForm(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM forms WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('Form deleted successfully', { formId: id });
      }
      
      return deleted;
    } finally {
      client.release();
    }
  }

  async searchForms(searchTerm: string, limit: number = 20): Promise<Form[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM forms 
        WHERE 
          to_tsvector('english', title) @@ to_tsquery('english', $1) OR
          to_tsvector('english', description) @@ to_tsquery('english', $1)
        ORDER BY ts_rank DESC
        LIMIT $2
      `;
      const result = await client.query(query, [searchTerm, limit]);
      
      return result.rows.map(row => this.mapRowToForm(row));
    } finally {
      client.release();
    }
  }

  private mapRowToForm(row: any): Form {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      schema: typeof row.schema === 'string' ? JSON.parse(row.schema) : row.schema,
      status: row.status,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}