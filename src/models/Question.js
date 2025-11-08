import { getPool } from '../config/database.js';
import { generateQuestionId } from '../utils/idGenerator.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

export class Question {
  constructor(data) {
    this.id = data.id;
    this.questionText = data.questionText ?? data.question_text;
    this.questionType = data.questionType ?? data.question_type;
    this.options = data.options;
    this.validationRules = data.validationRules ?? data.validation_rules;
    this.metadata = data.metadata;
    this.isActive = data.isActive ?? data.is_active;
    this.createdAt = data.createdAt ?? data.created_at;
    this.updatedAt = data.updatedAt ?? data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      questionText: this.questionText,
      questionType: this.questionType,
      options: this.options,
      validationRules: this.validationRules,
      metadata: this.metadata,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromRow(row) {
    if (!row) return null;
    return new Question({
      id: row.id,
      questionText: row.question_text,
      questionType: row.question_type,
      options: row.options,
      validationRules: row.validation_rules,
      metadata: row.metadata,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  static async create({ questionText, questionType, options = null, validationRules = null, metadata = {} }) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const id = await generateQuestionId(client);

      const result = await client.query(
        `INSERT INTO question_bank (id, question_text, question_type, options, validation_rules, metadata, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          questionText,
          questionType,
          options ? JSON.stringify(options) : null,
          validationRules ? JSON.stringify(validationRules) : null,
          JSON.stringify(metadata),
          true,
        ]
      );

      await client.query('COMMIT');

      return Question.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create question', error);
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM question_bank WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Question', id);
    }

    return Question.fromRow(result.rows[0]);
  }

  static async findAll({ questionType = null, isActive = null, limit = 100, offset = 0 } = {}) {
    const pool = getPool();
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (questionType) {
      whereClauses.push(`question_type = $${paramIndex++}`);
      params.push(questionType);
    }

    if (isActive !== null) {
      whereClauses.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    let query = 'SELECT * FROM question_bank';
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => Question.fromRow(row));
  }

  static async findByIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const pool = getPool();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const query = `SELECT * FROM question_bank WHERE id IN (${placeholders})`;

    const result = await pool.query(query, ids);
    return result.rows.map((row) => Question.fromRow(row));
  }

  static async update(id, updates) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const question = await Question.findById(id);

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updates.questionText !== undefined) {
        setClauses.push(`question_text = $${paramIndex++}`);
        values.push(updates.questionText);
      }

      if (updates.questionType !== undefined) {
        setClauses.push(`question_type = $${paramIndex++}`);
        values.push(updates.questionType);
      }

      if (updates.options !== undefined) {
        setClauses.push(`options = $${paramIndex++}`);
        values.push(updates.options ? JSON.stringify(updates.options) : null);
      }

      if (updates.validationRules !== undefined) {
        setClauses.push(`validation_rules = $${paramIndex++}`);
        values.push(updates.validationRules ? JSON.stringify(updates.validationRules) : null);
      }

      if (updates.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (updates.isActive !== undefined) {
        setClauses.push(`is_active = $${paramIndex++}`);
        values.push(updates.isActive);
      }

      if (setClauses.length === 0) {
        await client.query('COMMIT');
        return question;
      }

      values.push(id);
      const query = `UPDATE question_bank SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      return Question.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to update question', error);
    } finally {
      client.release();
    }
  }

  static async delete(id) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const question = await Question.findById(id);

      await client.query('DELETE FROM question_bank WHERE id = $1', [id]);

      await client.query('COMMIT');

      return question;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to delete question', error);
    } finally {
      client.release();
    }
  }

  static async count({ questionType = null, isActive = null } = {}) {
    const pool = getPool();
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (questionType) {
      whereClauses.push(`question_type = $${paramIndex++}`);
      params.push(questionType);
    }

    if (isActive !== null) {
      whereClauses.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    let query = 'SELECT COUNT(*) as count FROM question_bank';
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}
