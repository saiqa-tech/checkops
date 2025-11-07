import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { FormService } from '../src/services/FormService.js';
import { createPool, defaultDatabaseConfig } from '../src/config/database.js';

describe('FormService', () => {
  let pool: Pool;
  let formService: FormService;

  beforeAll(async () => {
    // Create a test database connection
    pool = createPool({
      ...defaultDatabaseConfig,
      database: 'checkops_test'
    });
    
    formService = new FormService(pool);
    
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
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create a form successfully', async () => {
    const createRequest = {
      title: 'Test Form',
      description: 'A test form for unit testing',
      schema: {
        id: 'test-form',
        fields: []
      },
      createdBy: 'test-user'
    };

    const form = await formService.createForm(createRequest);

    expect(form).toBeDefined();
    expect(form.id).toBeDefined();
    expect(form.title).toBe(createRequest.title);
    expect(form.description).toBe(createRequest.description);
    expect(form.status).toBe('active');
  });

  it('should get a form by id', async () => {
    // First create a form
    const createRequest = {
      title: 'Test Form for Get',
      schema: { id: 'test-get', fields: [] },
      createdBy: 'test-user'
    };
    const createdForm = await formService.createForm(createRequest);

    // Then get it
    const retrievedForm = await formService.getFormById(createdForm.id);

    expect(retrievedForm).toBeDefined();
    expect(retrievedForm?.id).toBe(createdForm.id);
    expect(retrievedForm?.title).toBe(createRequest.title);
  });

  it('should return null for non-existent form', async () => {
    const form = await formService.getFormById('non-existent-id');
    expect(form).toBeNull();
  });

  it('should get all forms', async () => {
    // Create a few forms
    await formService.createForm({
      title: 'Form 1',
      schema: { id: 'form1', fields: [] },
      createdBy: 'test-user'
    });
    await formService.createForm({
      title: 'Form 2',
      schema: { id: 'form2', fields: [] },
      createdBy: 'test-user'
    });

    const forms = await formService.getAllForms(10, 0);
    expect(forms).toBeDefined();
    expect(forms.length).toBeGreaterThanOrEqual(2);
  });

  it('should update a form', async () => {
    // Create a form first
    constcreateForm = {
      title: 'Original Title',
      schema: { id: 'update-test', fields: [] },
      createdBy: 'test-user'
    };
    const createdForm = await formService.createForm(createRequest);

    // Update it
    const updateRequest = {
      title: 'Updated Title',
      description: 'Updated description',
      status: 'inactive'
    };
    const updatedForm = await formService.updateForm(createdForm.id, updateRequest);

    expect(updatedForm).toBeDefined();
    expect(updatedForm?.title).toBe(updateRequest.title);
    expect(updatedForm?.description).toBe(updateRequest.description);
    expect(updatedForm?.status).toBe(updateRequest.status);
  });

  it('should delete a form', async () => {
    // Create a form first
    constcreateForm = {
      title: 'Form to Delete',
      schema: { id: 'delete-test', fields: [] },
      createdBy: 'test-user'
    };
    const createdForm = await formService.createForm(createRequest);

    // Delete it
    const deleted = await formService.deleteForm(createdForm.id);

    expect(deleted).toBe(true);
  });

  it('should search forms', async () => {
    // Create a searchable form
    await formService.createForm({
      title: 'Searchable Form',
      description: 'This form should be found by search',
      schema: { id: 'search-test', fields: [] },
      createdBy: 'test-user'
    });

    const searchResults = await formService.searchForms('searchable');

    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(0);
    const foundForm = searchResults.find(form => form.title.includes('searchable'));
    expect(foundForm).toBeDefined();
  });
});