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

    // OPTIMIZATION: Simple operations don't need explicit transactions
    // PostgreSQL handles single statements atomically
    const id = await generateFormId();

    try {
      const result = await pool.query(
        `INSERT INTO forms (id, title, description, questions, metadata, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, title, description, JSON.stringify(questions), JSON.stringify(metadata), true]
      );

      return Form.fromRow(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create form', error);
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

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => Form.fromRow(row));
  }

  static async update(id, updates) {
    const pool = getPool();

    // OPTIMIZATION: Single UPDATE operations don't need explicit transactions
    // First verify the form exists
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
      return form;
    }

    values.push(id);
    const query = `UPDATE forms SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    try {
      const result = await pool.query(query, values);
      return Form.fromRow(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to update form', error);
    }
  }

  static async delete(id) {
    const pool = getPool();

    // OPTIMIZATION: Simple DELETE operations don't need explicit transactions
    // First verify the form exists
    const form = await Form.findById(id);

    try {
      await pool.query('DELETE FROM forms WHERE id = $1', [id]);
      return form;
    } catch (error) {
      throw new DatabaseError('Failed to delete form', error);
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

  // OPTIMIZATION: Batch operations for high-throughput scenarios
  static async createMany(formsData) {
    if (!Array.isArray(formsData) || formsData.length === 0) {
      return [];
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Generate all IDs first
      const ids = [];
      for (let i = 0; i < formsData.length; i++) {
        const id = await generateFormId();
        ids.push(id);
      }

      // Build bulk insert query
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      formsData.forEach((formData, index) => {
        const id = ids[index];
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
        );
        values.push(
          id,
          formData.title,
          formData.description || '',
          JSON.stringify(formData.questions),
          JSON.stringify(formData.metadata || {}),
          true
        );
        paramIndex += 6;
      });

      const query = `
        INSERT INTO forms (id, title, description, questions, metadata, is_active)
        VALUES ${placeholders.join(', ')}
        RETURNING *
      `;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      return result.rows.map(row => Form.fromRow(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create forms in bulk', error);
    } finally {
      client.release();
    }
  }
}