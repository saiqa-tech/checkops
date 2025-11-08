export async function generateFormId(client) {
  const result = await client.query("SELECT get_next_id('form') as next_id");
  const nextId = result.rows[0].next_id;
  return `FORM-${String(nextId).padStart(3, '0')}`;
}

export async function generateQuestionId(client) {
  const result = await client.query("SELECT get_next_id('question') as next_id");
  const nextId = result.rows[0].next_id;
  return `Q-${String(nextId).padStart(3, '0')}`;
}

export async function generateSubmissionId(client) {
  const result = await client.query("SELECT get_next_id('submission') as next_id");
  const nextId = result.rows[0].next_id;
  return `SUB-${String(nextId).padStart(3, '0')}`;
}
