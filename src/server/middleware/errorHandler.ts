import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { CheckOpsSDKError, ValidationError, RequestError } from '../../errors.js';

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  code?: string;
  timestamp: string;
  requestId?: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Log the error with context
  logger.error('Request error occurred', {
    error: error.message,
    stack: error.stack,
    requestId,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  });

  let statusCode = 500;
  let errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    timestamp: new Date().toISOString(),
    requestId
  };

  if (error instanceof ValidationError) {
    statusCode = 400;
    errorResponse = {
      error: 'Validation Error',
      message: error.message,
      details: {
        validationErrors: error.details,
        warnings: error.warnings
      },
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error instanceof RequestError) {
    statusCode = error.status || 500;
    errorResponse = {
      error: 'Request Error',
      message: error.message,
      details: error.response,
      code: error.code.toUpperCase(),
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error instanceof CheckOpsSDKError) {
    statusCode = 400;
    errorResponse = {
      error: 'Configuration Error',
      message: error.message,
      code: 'CONFIGURATION_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.name === 'ValidationError') {
    // Joi validation errors
    statusCode = 400;
    errorResponse = {
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.name === 'CastError') {
    // Mongoose/MongoDB cast errors (if used in future)
    statusCode = 400;
    errorResponse = {
      error: 'Invalid Data Format',
      message: 'Invalid data format provided',
      code: 'INVALID_FORMAT',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    errorResponse = {
      error: 'Not Found',
      message: error.message,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
    statusCode = 401;
    errorResponse = {
      error: 'Unauthorized',
      message: error.message,
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
    statusCode = 403;
    errorResponse = {
      error: 'Forbidden',
      message: error.message,
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.message.includes('conflict')) {
    statusCode = 409;
    errorResponse = {
      error: 'Conflict',
      message: error.message,
      code: 'CONFLICT',
      timestamp: new Date().toISOString(),
      requestId
    };
  } else if (error.message.includes('rate limit')) {
    statusCode = 429;
    errorResponse = {
      error: 'Rate Limit Exceeded',
      message: error.message,
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  // In production, don't expose stack traces or internal error details
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.details = {
      ...errorResponse.details,
      stack: error.stack,
      name: error.name
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId
  });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    requestId
  });
};

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request ID middleware
export const requestIdHandler = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

// Health check endpoint
export const healthCheck = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development'
  });
};

// Generate a unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}