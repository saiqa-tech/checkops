import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger.js';

export interface ValidationSchema {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
}

export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push({
          location: 'body',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push({
          location: 'query',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push({
          location: 'params',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed', {
        url: req.url,
        method: req.method,
        errors,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    logger.debug('Validation passed', {
      url: req.url,
      method: req.method
    });

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().required().messages({
    'string.empty': 'ID is required',
    'any.required': 'ID is required'
  }),

  optionalId: Joi.string().optional(),

  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    offset: Joi.number().integer().min(0).default(0).messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset must be at least 0'
    })
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso().optional().messages({
      'date.format': 'Start date must be a valid ISO date'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
      'date.format': 'End date must be a valid ISO date',
      'date.min': 'End date must be after start date'
    })
  }),

  search: Joi.object({
    q: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Search query is required',
      'string.min': 'Search query must be at least 1 character',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required'
    }),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),

  status: Joi.string().valid('active', 'inactive', 'archived', 'pending', 'processed', 'failed').messages({
    'any.only': 'Status must be one of: active, inactive, archived, pending, processed, failed'
  }),

  formStatus: Joi.string().valid('active', 'inactive', 'archived').messages({
    'any.only': 'Form status must be one of: active, inactive, archived'
  }),

  submissionStatus: Joi.string().valid('pending', 'processed', 'failed', 'archived').messages({
    'any.only': 'Submission status must be one of: pending, processed, failed, archived'
  })
};

// Form-specific validation schemas
export const formSchemas = {
  createForm: Joi.object({
    title: Joi.string().min(1).max(500).optional().messages({
      'string.empty': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 500 characters'
    }),
    description: Joi.string().max(2000).optional().allow('').messages({
      'string.max': 'Description cannot exceed 2000 characters'
    }),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).default('1.0.0').messages({
      'string.pattern.base': 'Version must follow semantic versioning (e.g., 1.0.0)'
    }),
    schema: Joi.object({
      id: Joi.string().required(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      version: Joi.string().optional(),
      fields: Joi.array().items(
        Joi.object({
          id: Joi.string().optional(),
          name: Joi.string().required(),
          label: Joi.string().optional(),
          description: Joi.string().optional(),
          type: Joi.string().valid(
            'text', 'textarea', 'number', 'integer', 'boolean', 'date', 'datetime',
            'email', 'url', 'phone', 'select', 'multi-select', 'json'
          ).required(),
          required: Joi.boolean().optional(),
          min: Joi.number().optional(),
          max: Joi.number().optional(),
          minLength: Joi.number().optional(),
          maxLength: Joi.number().optional(),
          pattern: Joi.alternatives().try(
            Joi.string(),
            Joi.object().instance(RegExp)
          ).optional(),
          options: Joi.array().items(
            Joi.object({
              value: Joi.string().required(),
              label: Joi.string().optional(),
              disabled: Joi.boolean().optional()
            })
          ).optional(),
          multiple: Joi.boolean().optional(),
          defaultValue: Joi.any().optional(),
          validator: Joi.func().optional()
        })
      ).required(),
      metadata: Joi.object().optional()
    }).required().messages({
      'object.required': 'Form schema is required',
      'array.required': 'Form fields are required'
    }),
    status: commonSchemas.formStatus.optional(),
    metadata: Joi.object().optional()
  }),

  updateForm: Joi.object({
    title: Joi.string().min(1).max(500).optional().messages({
      'string.empty': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 500 characters'
    }),
    description: Joi.string().max(2000).optional().allow('').messages({
      'string.max': 'Description cannot exceed 2000 characters'
    }),
    status: commonSchemas.formStatus.optional(),
    metadata: Joi.object().optional()
  }),

  updateFormSchema: Joi.object({
    schema: Joi.object({
      id: Joi.string().required(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      version: Joi.string().optional(),
      fields: Joi.array().items(
        Joi.object({
          id: Joi.string().optional(),
          name: Joi.string().required(),
          label: Joi.string().optional(),
          description: Joi.string().optional(),
          type: Joi.string().valid(
            'text', 'textarea', 'number', 'integer', 'boolean', 'date', 'datetime',
            'email', 'url', 'phone', 'select', 'multi-select', 'json'
          ).required(),
          required: Joi.boolean().optional(),
          min: Joi.number().optional(),
          max: Joi.number().optional(),
          minLength: Joi.number().optional(),
          maxLength: Joi.number().optional(),
          pattern: Joi.alternatives().try(
            Joi.string(),
            Joi.object().instance(RegExp)
          ).optional(),
          options: Joi.array().items(
            Joi.object({
              value: Joi.string().required(),
              label: Joi.string().optional(),
              disabled: Joi.boolean().optional()
            })
          ).optional(),
          multiple: Joi.boolean().optional(),
          defaultValue: Joi.any().optional(),
          validator: Joi.func().optional()
        })
      ).required(),
      metadata: Joi.object().optional()
    }).required().messages({
      'object.required': 'Form schema is required',
      'array.required': 'Form fields are required'
    }),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional().messages({
      'string.pattern.base': 'Version must follow semantic versioning (e.g., 1.0.0)'
    })
  })
};

// API Key validation schemas
export const apiKeySchemas = {
  createApiKey: Joi.object({
    name: Joi.string().min(1).max(255).required().messages({
      'string.empty': 'API key name is required',
      'string.max': 'API key name cannot exceed 255 characters',
      'any.required': 'API key name is required'
    }),
    description: Joi.string().max(1000).optional().allow('').messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    permissions: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': 'At least one permission is required',
      'any.required': 'Permissions are required'
    }),
    rateLimitPerHour: Joi.number().integer().min(1).max(10000).default(1000).messages({
      'number.base': 'Rate limit must be a number',
      'number.integer': 'Rate limit must be an integer',
      'number.min': 'Rate limit must be at least 1',
      'number.max': 'Rate limit cannot exceed 10000'
    })
  }),

  updateApiKey: Joi.object({
    name: Joi.string().min(1).max(255).optional().messages({
      'string.empty': 'API key name cannot be empty',
      'string.max': 'API key name cannot exceed 255 characters'
    }),
    description: Joi.string().max(1000).optional().allow('').messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    permissions: Joi.array().items(Joi.string()).min(1).optional().messages({
      'array.min': 'At least one permission is required'
    }),
    rateLimitPerHour: Joi.number().integer().min(1).max(10000).optional().messages({
      'number.base': 'Rate limit must be a number',
      'number.integer': 'Rate limit must be an integer',
      'number.min': 'Rate limit must be at least 1',
      'number.max': 'Rate limit cannot exceed 10000'
    }),
    isActive: Joi.boolean().optional()
  })
};