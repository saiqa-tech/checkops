import { Response } from 'express';
import Joi from 'joi';
import { FormModel } from '../models/Form.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { validate, commonSchemas, formSchemas } from '../middleware/validation.js';
import type { FormSchema } from '../../types.js';

const formModel = new FormModel();

export const createForm = [
  validate({
    body: formSchemas.createForm
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { title, description, version, schema, status, metadata } = req.body;
    
    logger.info('Creating new form', {
      title,
      version,
      createdBy: req.apiKey?.id
    });

    const form = await formModel.createForm(
      schema as FormSchema,
      status,
      req.apiKey?.id
    );

    res.status(201).json({
      success: true,
      data: form,
      message: 'Form created successfully'
    });
  })
];

export const getForm = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.debug('Getting form', { formId: id, requestedBy: req.apiKey?.id });

    const form = await formModel.getForm(id);
    
    if (!form) {
      return res.status(404).json({
        error: 'Form not found',
        message: `Form with ID '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: form
    });
  })
];

export const updateForm = [
  validate({
    params: { id: commonSchemas.id },
    body: formSchemas.updateForm
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    logger.info('Updating form', {
      formId: id,
      updates,
      updatedBy: req.apiKey?.id
    });

    const form = await formModel.updateForm(
      id,
      updates,
      req.apiKey?.id
    );

    res.json({
      success: true,
      data: form,
      message: 'Form updated successfully'
    });
  })
];

export const updateFormSchema = [
  validate({
    params: { id: commonSchemas.id },
    body: formSchemas.updateFormSchema
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { schema, version } = req.body;
    
    logger.info('Updating form schema', {
      formId: id,
      version,
      updatedBy: req.apiKey?.id
    });

    const form = await formModel.updateFormSchema(
      id,
      schema as FormSchema,
      req.apiKey?.id
    );

    res.json({
      success: true,
      data: form,
      message: 'Form schema updated successfully'
    });
  })
];

export const deleteForm = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.info('Deleting form', {
      formId: id,
      deletedBy: req.apiKey?.id
    });

    await formModel.deleteForm(id);

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  })
];

export const listForms = [
  validate({
    query: {
      status: commonSchemas.formStatus.optional(),
      ...commonSchemas.pagination
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, limit, offset } = req.query;
    
    logger.debug('Listing forms', {
      status,
      limit,
      offset,
      requestedBy: req.apiKey?.id
    });

    const forms = await formModel.listForms(
      status as any,
      Number(limit),
      Number(offset)
    );

    res.json({
      success: true,
      data: forms,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        count: forms.length
      }
    });
  })
];

export const searchForms = [
  validate({
    query: commonSchemas.search
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit } = req.query;
    
    logger.debug('Searching forms', {
      query: q,
      limit,
      requestedBy: req.apiKey?.id
    });

    const forms = await formModel.searchForms(
      q as string,
      Number(limit)
    );

    res.json({
      success: true,
      data: forms,
      meta: {
        query: q,
        limit: Number(limit),
        count: forms.length
      }
    });
  })
];

export const getFormVersions = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.debug('Getting form versions', {
      formId: id,
      requestedBy: req.apiKey?.id
    });

    const versions = await formModel.getFormVersions(id);

    res.json({
      success: true,
      data: versions
    });
  })
];

export const getFormVersion = [
  validate({
    params: {
      id: commonSchemas.id,
      version: Joi.string().required()
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, version } = req.params;
    
    logger.debug('Getting specific form version', {
      formId: id,
      version,
      requestedBy: req.apiKey?.id
    });

    const formVersion = await formModel.getFormVersion(id, version);
    
    if (!formVersion) {
      return res.status(404).json({
        error: 'Form version not found',
        message: `Form version '${version}' for form '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: formVersion
    });
  })
];