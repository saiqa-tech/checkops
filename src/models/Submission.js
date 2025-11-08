import { getPool } from '../config/database.js';
import { generateSubmissionId } from '../utils/idGenerator.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

export class Submission {
  constructor(data) {
    this.id = data.id;
    this.formId = data.formId ?? data.form_id;
    this.submissionData = data.submissionData ?? data.submission_data;
    this.metadata = data.metadata;
    this.submittedAt = data.submittedAt ?? data.submitted_at;
  }

  toJSON() {
    return {
      id: this.id,
      formId: this.formId,
      submissionData: this.submissionData,
      metadata: this.metadata,
      submittedAt: this.submittedAt,
    };
  }

  static fromRow(row) {
    if (!row) return null;
    return new Submission({
      id: row.id,
      formId: row.form_id,
      submissionData: row.submission_data,
      metadata: row.metadata,
      submittedAt: row.submitted_at,
    });
  }

  static async create({ formId, submissionData, metadata = {} }) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const formCheck = await client.query('SELECT id FROM forms WHERE id = $1', [formId]);
      if (formCheck.rows.length === 0) {
        throw new NotFoundError('Form', formId);
      }

      const id = await generateSubmissionId(client);

      const result = await client.query(
        `INSERT INTO submissions (id, form_id, submission_data, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, formId, JSON.stringify(submissionData), JSON.stringify(metadata)]
      );

      await client.query('COMMIT');

      return Submission.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to create submission', error);
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Submission', id);
    }

    return Submission.fromRow(result.rows[0]);
  }

  static async findByFormId(formId, { limit = 100, offset = 0 } = {}) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM submissions WHERE form_id = $1 ORDER BY submitted_at DESC LIMIT $2 OFFSET $3',
      [formId, limit, offset]
    );

    return result.rows.map((row) => Submission.fromRow(row));
  }

  static async findAll({ limit = 100, offset = 0 } = {}) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM submissions ORDER BY submitted_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows.map((row) => Submission.fromRow(row));
  }

  static async update(id, updates) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const submission = await Submission.findById(id);

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updates.submissionData !== undefined) {
        setClauses.push(`submission_data = $${paramIndex++}`);
        values.push(JSON.stringify(updates.submissionData));
      }

      if (updates.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (setClauses.length === 0) {
        await client.query('COMMIT');
        return submission;
      }

      values.push(id);
      const query = `UPDATE submissions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      return Submission.fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to update submission', error);
    } finally {
      client.release();
    }
  }

  static async delete(id) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const submission = await Submission.findById(id);

      await client.query('DELETE FROM submissions WHERE id = $1', [id]);

      await client.query('COMMIT');

      return submission;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to delete submission', error);
    } finally {
      client.release();
    }
  }

  static async count({ formId = null } = {}) {
    const pool = getPool();
    let query = 'SELECT COUNT(*) as count FROM submissions';
    const params = [];

    if (formId) {
      query += ' WHERE form_id = $1';
      params.push(formId);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}
