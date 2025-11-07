import { Response } from 'express';
import Joi from 'joi';
import { SubmissionModel } from '../models/Submission.js';
import { FormModel } from '../models/Form.js';
import { validateFormData } from '../../validation.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import type { SubmissionPayload } from '../../types.js';

const submissionModel = new SubmissionModel();
const formModel = new FormModel();

export const createSubmission = [
  validate({
    params: { formId: commonSchemas.id },
    body: Joi.object({
      version: Joi.string().optional(),
      data: Joi.object().required().messages({
        'object.required': 'Submission data is required'
      }),
      metadata: Joi.object().optional(),
      source: Joi.string().max(100).optional(),
      submittedAt: Joi.date().iso().optional()
    })
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { formId } = req.params;
    const { version, data, metadata, source, submittedAt } = req.body;
    
    logger.info('Creating submission', {
      formId,
      version,
      submittedBy: req.apiKey?.id,
      ip: req.ip
    });

    // Get the form to validate against
    const form = await formModel.getForm(formId);
    if (!form) {
      return res.status(404).json({
        error: 'Form not found',
        message: `Form with ID '${formId}' not found`
      });
    }

    if (form.status !== 'active') {
      return res.status(400).json({
        error: 'Form inactive',
        message: `Form '${formId}' is not active and cannot accept submissions`
      });
    }

    // Validate the submission data against the form schema
    const validation = await validateFormData(form.schema, data);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Submission data is invalid',
        details: {
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    }

    // Create the submission payload
    const payload: SubmissionPayload = {
      formId,
      version: version || form.version,
      submittedAt: submittedAt || new Date().toISOString(),
      data: validation.data,
      metadata,
      source
    };

    // Create the submission
    const submission = await submissionModel.createSubmission(
      formId,
      payload,
      req.ip,
      req.get('User-Agent')
    );

    // Update submission status to processed (in a real app, you might want to process asynchronously)
    await submissionModel.updateSubmissionStatus(submission.id, 'processed');

    res.status(201).json({
      success: true,
      data: {
        id: submission.id,
        submissionId: submission.submissionId,
        formId: submission.formId,
        version: submission.version,
        submittedAt: submission.submittedAt,
        status: 'processed',
        validation: {
          warnings: validation.warnings
        }
      },
      message: 'Submission created successfully'
    });
  })
];

export const getSubmission = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.debug('Getting submission', {
      submissionId: id,
      requestedBy: req.apiKey?.id
    });

    const submission = await submissionModel.getSubmission(id);
    
    if (!submission) {
      return res.status(404).json({
        error: 'Submission not found',
        message: `Submission with ID '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: submission
    });
  })
];

export const getSubmissionBySubmissionId = [
  validate({
    params: { submissionId: Joi.string().required() }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { submissionId } = req.params;
    
    logger.debug('Getting submission by submission ID', {
      submissionId,
      requestedBy: req.apiKey?.id
    });

    const submission = await submissionModel.getSubmissionBySubmissionId(submissionId);
    
    if (!submission) {
      return res.status(404).json({
        error: 'Submission not found',
        message: `Submission with ID '${submissionId}' not found`
      });
    }

    res.json({
      success: true,
      data: submission
    });
  })
];

export const updateSubmissionStatus = [
  validate({
    params: { id: commonSchemas.id },
    body: Joi.object({
      status: Joi.string().valid('pending', 'processed', 'failed', 'archived').required(),
      error: Joi.string().optional()
    })
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, error } = req.body;
    
    logger.info('Updating submission status', {
      submissionId: id,
      status,
      error,
      updatedBy: req.apiKey?.id
    });

    const submission = await submissionModel.updateSubmissionStatus(
      id,
      status,
      error
    );

    res.json({
      success: true,
      data: submission,
      message: 'Submission status updated successfully'
    });
  })
];

export const listSubmissions = [
  validate({
    query: {
      formId: commonSchemas.optionalId,
      status: commonSchemas.submissionStatus.optional(),
      ...commonSchemas.pagination,
      ...commonSchemas.dateRange
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { formId, status, limit, offset, startDate, endDate } = req.query;
    
    logger.debug('Listing submissions', {
      formId,
      status,
      limit,
      offset,
      startDate,
      endDate,
      requestedBy: req.apiKey?.id
    });

    const submissions = await submissionModel.listSubmissions(
      formId as string,
      status as any,
      Number(limit),
      Number(offset),
      startDate as Date,
      endDate as Date
    );

    res.json({
      success: true,
      data: submissions,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        count: submissions.length
      }
    });
  })
];

export const getSubmissionStats = [
  validate({
    query: {
      formId: commonSchemas.optionalId
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { formId } = req.query;
    
    logger.debug('Getting submission stats', {
      formId,
      requestedBy: req.apiKey?.id
    });

    const stats = await submissionModel.getSubmissionStats(formId as string);

    res.json({
      success: true,
      data: stats
    });
  })
];

export const searchSubmissions = [
  validate({
    query: {
      ...commonSchemas.search,
      formId: commonSchemas.optionalId
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit, formId } = req.query;
    
    logger.debug('Searching submissions', {
      query: q,
      formId,
      limit,
      requestedBy: req.apiKey?.id
    });

    const submissions = await submissionModel.searchSubmissions(
      q as string,
      formId as string,
      Number(limit)
    );

    res.json({
      success: true,
      data: submissions,
      meta: {
        query: q,
        formId,
        limit: Number(limit),
        count: submissions.length
      }
    });
  })
];

export const deleteSubmission = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.info('Deleting submission', {
      submissionId: id,
      deletedBy: req.apiKey?.id
    });

    await submissionModel.deleteSubmission(id);

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  })
];

export const getRecentSubmissions = [
  validate({
    params: { formId: commonSchemas.id },
    query: {
      hours: Joi.number().integer().min(1).max(168).default(24), // Max 1 week
      limit: Joi.number().integer().min(1).max(100).default(10)
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { formId } = req.params;
    const { hours, limit } = req.query;
    
    logger.debug('Getting recent submissions', {
      formId,
      hours,
      limit,
      requestedBy: req.apiKey?.id
    });

    const submissions = await submissionModel.getRecentSubmissions(
      formId,
      Number(hours),
      Number(limit)
    );

    res.json({
      success: true,
      data: submissions,
      meta: {
        formId,
        hours: Number(hours),
        limit: Number(limit),
        count: submissions.length
      }
    });
  })
];