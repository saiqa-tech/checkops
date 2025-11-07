import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface Question {
  id: string;
  questionBankId: string;
  text: string;
  type: 'multiple_choice' | 'text' | 'number' | 'date' | 'boolean';
  options?: string[];
  required: boolean;
  validation?: any;
  order: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuestionRequest {
  questionBankId: string;
  text: string;
  type: Question['type'];
  options?: string[];
  required: boolean;
  validation?: any;
  order: number;
  createdBy: string;
}

export interface CreateQuestionBankRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  createdBy: string;
}

export class QuestionService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createQuestionBank(request: CreateQuestionBankRequest): Promise<QuestionBank> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO question_banks (name, description, is_public, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.name,
        request.description || null,
        request.isPublic,
        request.createdBy
      ]);

      logger.info('Question bank created successfully', { questionBankId: result.rows[0].id });
      return this.mapRowToQuestionBank(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async createQuestion(request: CreateQuestionRequest): Promise<Question> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO questions (question_bank_id, text, type, options, required, validation, order, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.questionBankId,
        request.text,
        request.type,
        request.options ? JSON.stringify(request.options) : null,
        request.required,
        request.validation ? JSON.stringify(request.validation) : null,
        request.order,
        request.createdBy
      ]);

      logger.info('Question created successfully', { questionId: result.rows[0].id });
      return this.mapRowToQuestion(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getQuestionBankById(id: string): Promise<QuestionBank | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM question_banks WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToQuestionBank(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getQuestionById(id: string): Promise<Question | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM questions WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToQuestion(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getQuestionsByBankId(questionBankId: string): Promise<Question[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM questions 
        WHERE question_bank_id = $1 
        ORDER BY "order" ASC, created_at ASC
      `;
      const result = await client.query(query, [questionBankId]);
      
      return result.rows.map(row => this.mapRowToQuestion(row));
    } finally {
      client.release();
    }
  }

  async getAllQuestionBanks(limit: number = 50, offset: number = 0): Promise<QuestionBank[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM question_banks 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToQuestionBank(row));
    } finally {
      client.release();
    }
  }

  async updateQuestion(id: string, updates: Partial<Omit<Question, 'id' | 'questionBankId' | 'createdAt' | 'updatedAt'>>): Promise<Question | null> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          if (key === 'options' || key === 'validation') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE questions 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Question updated successfully', { questionId: id });
      return this.mapRowToQuestion(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM questions WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info('Question deleted successfully', { questionId: id });
      }
      
      return deleted;
    } finally {
      client.release();
    }
  }

  async searchQuestions(searchTerm: string, limit: number = 20): Promise<Question[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM questions 
        WHERE 
          to_tsvector('english', text) @@ to_tsquery('english', $1)
        ORDER BY ts_rank DESC
        LIMIT $2
      `;
      const result = await client.query(query, [searchTerm, limit]);
      
      return result.rows.map(row => this.mapRowToQuestion(row));
    } finally {
      client.release();
    }
  }

  private mapRowToQuestionBank(row: any): QuestionBank {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isPublic: row.is_public,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToQuestion(row: any): Question {
    return {
      id: row.id,
      questionBankId: row.question_bank_id,
      text: row.text,
      type: row.type,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
      required: row.required,
      validation: typeof row.validation === 'string' ? JSON.parse(row.validation) : row.validation,
      order: row.order,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}