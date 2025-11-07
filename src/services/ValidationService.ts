import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

export interface ValidationRule {
  id: string;
  fieldId: string;
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'email' | 'number_range' | 'custom';
  parameters: any;
  errorMessage?: string;
}

export interface CreateValidationRuleRequest {
  fieldId: string;
  type: ValidationRule['type'];
  parameters: any;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export class ValidationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createValidationRule(request: CreateValidationRuleRequest): Promise<ValidationRule> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO validation_rules (field_id, type, parameters, error_message, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        request.fieldId,
        request.type,
        JSON.stringify(request.parameters),
        request.errorMessage || null
      ]);

      logger.debug('Validation rule created', { ruleId: result.rows[0].id });
      return this.mapRowToValidationRule(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getValidationRuleById(id: string): Promise<ValidationRule | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM validation_rules WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToValidationRule(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getValidationRulesByFieldId(fieldId: string): Promise<ValidationRule[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM validation_rules 
        WHERE field_id = $1 
        ORDER BY created_at ASC
      `;
      const result = await client.query(query, [fieldId]);
      
      return result.rows.map(row => this.mapRowToValidationRule(row));
    } finally {
      client.release();
    }
  }

  async getAllValidationRules(limit: number = 100, offset: number = 0): Promise<ValidationRule[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM validation_rules 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      
      return result.rows.map(row => this.mapRowToValidationRule(row));
    } finally {
      client.release();
    }
  }

  async deleteValidationRule(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM validation_rules WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.debug('Validation rule deleted', { ruleId: id });
      }
      
      return deleted;
    } finally {
      client.release();
    }
  }

  async validateSubmission(data: any, formId: string): Promise<ValidationResult> {
    const client = await this.pool.connect();
    try {
      // Get validation rules for the form
      const rulesQuery = 'SELECT * FROM validation_rules WHERE field_id IN (SELECT id FROM form_fields WHERE form_id = $1)';
      const rulesResult = await client.query(rulesQuery, [formId]);
      
      const errors: string[] = [];
      const validatedData: any = { ...data };

      for (const rule of rulesResult.rows.map(row => this.mapRowToValidationRule(row))) {
        const fieldValue = data[rule.fieldId];
        const isValid = await this.applyValidationRule(rule, fieldValue);
        
        if (!isValid.isValid) {
          errors.push(isValid.errorMessage || rule.errorMessage || `Validation failed for field ${rule.fieldId}`);
        } else if (isValid.data !== undefined) {
          validatedData[rule.fieldId] = isValid.data;
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: validatedData
      };
    } finally {
      client.release();
    }
  }

  private async applyValidationRule(rule: ValidationRule, value: any): Promise<{ isValid: boolean; errorMessage?: string; data?: any }> {
    switch (rule.type) {
      case 'required':
        return {
          isValid: value !== null && value !== undefined && value !== '',
          errorMessage: rule.errorMessage || 'This field is required'
        };

      case 'min_length':
        const minLength = rule.parameters.minLength || 1;
        const strValue = String(value || '');
        return {
          isValid: strValue.length >= minLength,
          errorMessage: rule.errorMessage || `Must be at least ${minLength} characters`
        };

      case 'max_length':
        const maxLength = rule.parameters.maxLength || 255;
        const strValue2 = String(value || '');
        return {
          isValid: strValue2.length <= maxLength,
          errorMessage: rule.errorMessage || `Must be no more than ${maxLength} characters`
        };

      case 'pattern':
        const pattern = new RegExp(rule.parameters.pattern);
        const strValue3 = String(value || '');
        return {
          isValid: pattern.test(strValue3),
          errorMessage: rule.errorMessage || 'Invalid format'
        };

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const strValue4 = String(value || '');
        return {
          isValid: emailPattern.test(strValue4),
          errorMessage: rule.errorMessage || 'Invalid email address'
        };

      case 'number_range':
        const num = Number(value);
        const min = rule.parameters.min;
        const max = rule.parameters.max;
        return {
          isValid: !isNaN(num) && num >= min && num <= max,
          errorMessage: rule.errorMessage || `Must be between ${min} and ${max}`,
          data: !isNaN(num) ? num : value
        };

      case 'custom':
        // For custom validation, you might want to allow custom functions
        // For this implementation, we'll assume it passes
        return {
          isValid: true,
          errorMessage: rule.errorMessage || 'Custom validation failed'
        };

      default:
        return {
          isValid: true,
          errorMessage: rule.errorMessage || 'Unknown validation rule'
        };
    }
  }

  private mapRowToValidationRule(row: any): ValidationRule {
    return {
      id: row.id,
      fieldId: row.field_id,
      type: row.type,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      errorMessage: row.error_message
    };
  }
}