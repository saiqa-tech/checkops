import { Response } from 'express';
import Joi from 'joi';
import { ApiKeyModel } from '../models/ApiKey.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { validate, commonSchemas, apiKeySchemas } from '../middleware/validation.js';

const apiKeyModel = new ApiKeyModel();

export const createApiKey = [
  validate({
    body: apiKeySchemas.createApiKey
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, permissions, rateLimitPerHour } = req.body;
    
    logger.info('Creating new API key', {
      name,
      permissions,
      rateLimitPerHour,
      createdBy: req.apiKey?.id
    });

    const result = await apiKeyModel.createApiKey({
      name,
      description,
      permissions,
      rateLimitPerHour,
      createdBy: req.apiKey?.id
    });

    res.status(201).json({
      success: true,
      data: {
        apiKey: result.apiKey, // Only returned once during creation
        details: result.details
      },
      message: 'API key created successfully. Save the API key securely as it will not be shown again.'
    });
  })
];

export const getApiKey = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.debug('Getting API key', {
      keyId: id,
      requestedBy: req.apiKey?.id
    });

    const apiKey = await apiKeyModel.getApiKey(id);
    
    if (!apiKey) {
      return res.status(404).json({
        error: 'API key not found',
        message: `API key with ID '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: apiKey
    });
  })
];

export const updateApiKey = [
  validate({
    params: { id: commonSchemas.id },
    body: apiKeySchemas.updateApiKey
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    logger.info('Updating API key', {
      keyId: id,
      updates,
      updatedBy: req.apiKey?.id
    });

    const apiKey = await apiKeyModel.updateApiKey(
      id,
      updates,
      req.apiKey?.id
    );

    res.json({
      success: true,
      data: apiKey,
      message: 'API key updated successfully'
    });
  })
];

export const revokeApiKey = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.info('Revoking API key', {
      keyId: id,
      revokedBy: req.apiKey?.id
    });

    await apiKeyModel.revokeApiKey(id);

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  })
];

export const deleteApiKey = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.info('Deleting API key', {
      keyId: id,
      deletedBy: req.apiKey?.id
    });

    await apiKeyModel.deleteApiKey(id);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  })
];

export const regenerateApiKey = [
  validate({
    params: { id: commonSchemas.id }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    logger.info('Regenerating API key', {
      keyId: id,
      requestedBy: req.apiKey?.id
    });

    const newApiKey = await apiKeyModel.regenerateApiKey(id);

    res.json({
      success: true,
      data: {
        apiKey: newApiKey
      },
      message: 'API key regenerated successfully. Save the new API key securely as it will not be shown again.'
    });
  })
];

export const listApiKeys = [
  validate({
    query: {
      includeInactive: Joi.boolean().default(false)
    }
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { includeInactive } = req.query;
    
    logger.debug('Listing API keys', {
      includeInactive,
      requestedBy: req.apiKey?.id
    });

    const apiKeys = await apiKeyModel.listApiKeys(Boolean(includeInactive));

    res.json({
      success: true,
      data: apiKeys,
      meta: {
        count: apiKeys.length,
        includeInactive: Boolean(includeInactive)
      }
    });
  })
];