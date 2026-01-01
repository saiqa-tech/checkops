import { getPool } from '../config/database.js';

export async function generateFormId(client = null) {
  const pool = client || getPool();
  const result = await pool.query("SELECT get_next_id('form') as next_id");
  const nextId = result.rows[0].next_id;
  return `FORM-${String(nextId).padStart(3, '0')}`;
}

export async function generateQuestionId(client = null) {
  const pool = client || getPool();
  const result = await pool.query("SELECT get_next_id('question') as next_id");
  const nextId = result.rows[0].next_id;
  return `Q-${String(nextId).padStart(3, '0')}`;
}

export async function generateSubmissionId(client = null) {
  const pool = client || getPool();
  const result = await pool.query("SELECT get_next_id('submission') as next_id");
  const nextId = result.rows[0].next_id;
  return `SUB-${String(nextId).padStart(3, '0')}`;
}
