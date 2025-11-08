import { getPool } from '../config/database.js';
import { generateFormId } from '../utils/idGenerator.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

export class Form {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.questions = data.questions;
    this.metadata = data.metadata;
    this.isActive = data.isActive ?? data.is_active;
    this.createdAt = data.createdAt ?? data.created_at;
    this.updatedAt = data.updatedAt ?? data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      questions: this.questions,
      metadata: this.metadata,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromRow(row) {
    if (!row) return null;
    return new Form({
      id: row.id,
      title: row.title,
      description: row.description,
      questions: row.questions,
      metadata: row.metadata,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  static async create({ title, description, questions, metadata = {} }) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const id = await generateFormId(client);

      const result = await client.query(
        `INSERT INTO forms (id, title, description, questions, metadata, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, title, description, JSON.stringify(questions), JSON.stringify(metadata), true]
      );

      await client.query('COMMIT');

      return Form.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create form', error);
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM forms WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Form', id);
    }

    return Form.fromRow(result.rows[0]);
  }

  static async findAll({ isActive = null, limit = 100, offset = 0 } = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM forms';
    const params = [];

    if (isActive !== null) {
      query += ' WHERE is_active = $1';
      params.push(isActive);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => Form.fromRow(row));
  }

  static async update(id, updates) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const form = await Form.findById(id);

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.questions !== undefined) {
        setClauses.push(`questions = $${paramIndex++}`);
        values.push(JSON.stringify(updates.questions));
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
        return form;
      }

      values.push(id);
      const query = `UPDATE forms SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      return Form.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to update form', error);
    } finally {
      client.release();
    }
  }

  static async delete(id) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const form = await Form.findById(id);

      await client.query('DELETE FROM forms WHERE id = $1', [id]);

      await client.query('COMMIT');

      return form;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to delete form', error);
    } finally {
      client.release();
    }
  }

  static async count({ isActive = null } = {}) {
    const pool = getPool();
    let query = 'SELECT COUNT(*) as count FROM forms';
    const params = [];

    if (isActive !== null) {
      query += ' WHERE is_active = $1';
      params.push(isActive);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}
