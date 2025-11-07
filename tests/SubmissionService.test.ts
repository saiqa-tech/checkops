import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { createPool, defaultDatabaseConfig } from '../src/config/database.js';

describe('SubmissionService', () => {
  let pool: Pool;
  let submissionService: SubmissionService;

  beforeAll(async () => {
    pool = createPool({
      ...defaultDatabaseConfig,
      database: 'checkops_test'
    });
    
    submissionService = new SubmissionService(pool);
    
    // Create tables for testing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        schema JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        submitted_by VARCHAR(255),
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create a submission successfully', async () => {
    // First create a form
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Test Form', JSON.stringify({ id: 'test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    const createRequest = {
      formId,
      data: { name: 'John Doe', email: 'john@example.com' },
      submittedBy: 'test-user'
    };

    const submission = await submissionService.createSubmission(createRequest);

    expect(submission).toBeDefined();
    expect(submission.id).toBeDefined();
    expect(submission.formId).toBe(formId);
    expect(submission.data).toEqual(createRequest.data);
    expect(submission.status).toBe('pending');
  });

  it('should get submission by id', async () => {
    // Create a form and submission first
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Get Test Form', JSON.stringify({ id: 'get-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    const createRequest = {
      formId,
      data: { test: 'data' },
      submittedBy: 'test-user'
    };
    const createdSubmission = await submissionService.createSubmission(createRequest);

    // Get the submission
    const retrievedSubmission = await submissionService.getSubmissionById(createdSubmission.id);

    expect(retrievedSubmission).toBeDefined();
    expect(retrievedSubmission?.id).toBe(createdSubmission.id);
    expect(retrievedSubmission?.formId).toBe(formId);
  });

  it('should return null for non-existent submission', async () => {
    const submission = await submissionService.getSubmissionById('non-existent-id');
    expect(submission).toBeNull();
  });

  it('should get submissions by form id', async () => {
    // Create a form
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['List Test Form', JSON.stringify({ id: 'list-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    // Create multiple submissions
    await submissionService.createSubmission({ formId, data: { test: 1 }, submittedBy: 'test-user' });
    await submissionService.createSubmission({ formId, data: { test: 2 }, submittedBy: 'test-user' });
    await submissionService.createSubmission({ formId, data: { test: 3 }, submittedBy: 'test-user' });

    const submissions = await submissionService.getSubmissionsByFormId(formId, 10, 0);

    expect(submissions).toBeDefined();
    expect(submissions.length).toBe(3);
    expect(submissions.every(s => s.formId === formId)).toBe(true);
  });

  it('should update submission status', async () => {
    // Create a submission first
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Update Test Form', JSON.stringify({ id: 'update-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    const createRequest = {
      formId,
      data: { update: 'test' },
      submittedBy: 'test-user'
    };
    const createdSubmission = await submissionService.createSubmission(createRequest);

    // Update the submission
    const updateRequest = {
      status: 'processed',
      errorMessage: 'Processed successfully'
    };
    const updatedSubmission = await submissionService.updateSubmission(createdSubmission.id, updateRequest);

    expect(updatedSubmission).toBeDefined();
    expect(updatedSubmission?.id).toBe(createdSubmission.id);
    expect(updatedSubmission?.status).toBe(updateRequest.status);
    expect(updatedSubmission?.errorMessage).toBe(updateRequest.errorMessage);
  });

  it('should delete submission', async () => {
    // Create a submission first
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Delete Test Form', JSON.stringify({ id: 'delete-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    const createRequest = {
      formId,
      data: { delete: 'test' },
      submittedBy: 'test-user'
    };
    const createdSubmission = await submissionService.createSubmission(createRequest);

    // Delete the submission
    const deleted = await submissionService.deleteSubmission(createdSubmission.id);

    expect(deleted).toBe(true);
  });

  it('should get submission statistics', async () => {
    // Create a form and some submissions
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Stats Test Form', JSON.stringify({ id: 'stats-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    await submissionService.createSubmission({ formId, data: { stats: 1 }, submittedBy: 'test-user' });
    await submissionService.createSubmission({ formId, data: { stats: 2 }, submittedBy: 'test-user' });
    await submissionService.createSubmission({ formId, data: { stats: 3 }, submittedBy: 'test-user' });

    const stats = await submissionService.getSubmissionStats(formId);

    expect(stats).toBeDefined();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.processed).toBeGreaterThanOrEqual(0);
    expect(stats.failed).toBeGreaterThanOrEqual(0);
  });

  it('should search submissions', async () => {
    // Create a submission with searchable data
    const formResult = await pool.query(`
      INSERT INTO forms (title, schema, created_by)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Search Test Form', JSON.stringify({ id: 'search-test', fields: [] }), 'test-user']);

    const formId = formResult.rows[0].id;

    const createRequest = {
      formId,
      data: { searchable: 'search content here' },
      submittedBy: 'test-user'
    };
    await submissionService.createSubmission(createRequest);

    const searchResults = await submissionService.searchSubmissions('searchable');

    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(0);
    const foundSubmission = searchResults.find(s => 
      typeof s.data === 'object' && s.data.searchable === 'search content here'
    );
    expect(foundSubmission).toBeDefined();
  });
});