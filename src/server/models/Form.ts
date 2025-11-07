import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { CounterModel } from './Counter.js';
import type { FormSchema } from '../../types.js';

export interface FormRow {
  id: string;
  title?: string;
  description?: string;
  version: string;
  schema: FormSchema;
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface FormVersionRow {
  id: string;
  formId: string;
  version: string;
  schema: FormSchema;
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
  createdAt: Date;
  createdBy?: string;
}

export class FormModel {
  private db = getDatabase();
  private counterModel = new CounterModel();

  async createForm(
    schema: FormSchema,
    status: FormRow['status'] = 'active',
    createdBy?: string
  ): Promise<FormRow> {
    const query = `
      INSERT INTO forms (id, title, description, version, schema, status, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    try {
      const formId = await this.counterModel.getNextValue('forms');
      const formIdString = `form_${formId}`;
      
      const result = await this.db.queryOne<FormRow>(query, [
        formIdString,
        schema.title,
        schema.description,
        schema.version || '1.0.0',
        schema,
        status,
        schema.metadata,
        createdBy
      ]);

      if (!result) {
        throw new Error('Failed to create form');
      }

      await this.createFormVersion(result.id, schema, status, createdBy);
      
      logger.info(`Created form: ${result.id} with version: ${result.version}`);
      return result;
    } catch (error) {
      logger.error('Failed to create form', error);
      throw error;
    }
  }

  async getForm(formId: string): Promise<FormRow | null> {
    const query = `
      SELECT * FROM forms WHERE id = $1
    `;

    try {
      const result = await this.db.queryOne<FormRow>(query, [formId]);
      return result;
    } catch (error) {
      logger.error(`Failed to get form: ${formId}`, error);
      throw error;
    }
  }

  async updateForm(
    formId: string,
    updates: Partial<Pick<FormRow, 'title' | 'description' | 'status' | 'metadata'>>,
    updatedBy?: string
  ): Promise<FormRow> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(formId);

    const query = `
      UPDATE forms 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.db.queryOne<FormRow>(query, values);
      
      if (!result) {
        throw new Error(`Form with id '${formId}' not found`);
      }

      logger.info(`Updated form: ${formId}`);
      return result;
    } catch (error) {
      logger.error(`Failed to update form: ${formId}`, error);
      throw error;
    }
  }

  async updateFormSchema(
    formId: string,
    newSchema: FormSchema,
    updatedBy?: string
  ): Promise<FormRow> {
    const query = `
      UPDATE forms 
      SET schema = $2, version = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.db.queryOne<FormRow>(query, [
        formId,
        newSchema,
        newSchema.version || '1.0.0'
      ]);

      if (!result) {
        throw new Error(`Form with id '${formId}' not found`);
      }

      await this.createFormVersion(result.id, newSchema, result.status, updatedBy);
      
      logger.info(`Updated form schema: ${formId} to version: ${result.version}`);
      return result;
    } catch (error) {
      logger.error(`Failed to update form schema: ${formId}`, error);
      throw error;
    }
  }

  async deleteForm(formId: string): Promise<void> {
    const query = `DELETE FROM forms WHERE id = $1`;

    try {
      const result = await this.db.query(query, [formId]);
      
      if (result.length === 0) {
        throw new Error(`Form with id '${formId}' not found`);
      }

      logger.info(`Deleted form: ${formId}`);
    } catch (error) {
      logger.error(`Failed to delete form: ${formId}`, error);
      throw error;
    }
  }

  async listForms(
    status?: FormRow['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<FormRow[]> {
    let query = `
      SELECT * FROM forms
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` WHERE status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    try {
      const forms = await this.db.query<FormRow>(query, params);
      return forms;
    } catch (error) {
      logger.error('Failed to list forms', error);
      throw error;
    }
  }

  async searchForms(query: string, limit: number = 20): Promise<FormRow[]> {
    const searchQuery = `
      SELECT * FROM forms 
      WHERE 
        ILIKE(title, $1) OR 
        ILIKE(description, $1) OR
        ILIKE(id, $1)
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const forms = await this.db.query<FormRow>(searchQuery, [`%${query}%`, limit]);
      return forms;
    } catch (error) {
      logger.error(`Failed to search forms with query: ${query}`, error);
      throw error;
    }
  }

  private async createFormVersion(
    formId: string,
    schema: FormSchema,
    status: FormRow['status'],
    createdBy?: string
  ): Promise<void> {
    const query = `
      INSERT INTO form_versions (form_id, version, schema, status, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    try {
      await this.db.query(query, [
        formId,
        schema.version || '1.0.0',
        schema,
        status,
        schema.metadata,
        createdBy
      ]);
    } catch (error) {
      logger.error(`Failed to create form version for: ${formId}`, error);
      throw error;
    }
  }

  async getFormVersions(formId: string): Promise<FormVersionRow[]> {
    const query = `
      SELECT * FROM form_versions 
      WHERE form_id = $1 
      ORDER BY created_at DESC
    `;

    try {
      const versions = await this.db.query<FormVersionRow>(query, [formId]);
      return versions;
    } catch (error) {
      logger.error(`Failed to get form versions for: ${formId}`, error);
      throw error;
    }
  }

  async getFormVersion(formId: string, version: string): Promise<FormVersionRow | null> {
    const query = `
      SELECT * FROM form_versions 
      WHERE form_id = $1 AND version = $2
    `;

    try {
      const result = await this.db.queryOne<FormVersionRow>(query, [formId, version]);
      return result;
    } catch (error) {
      logger.error(`Failed to get form version: ${formId}@${version}`, error);
      throw error;
    }
  }
}

function ILIKE(column: string, value: string): string {
  return `${column} ILIKE ${value}`;
}