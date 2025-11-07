export class CheckOpsError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'CheckOpsError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends CheckOpsError {
  public readonly details: any;

  constructor(message: string, details: any) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class AuthenticationError extends CheckOpsError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends CheckOpsError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends CheckOpsError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
  }
}

export class DatabaseError extends CheckOpsError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500);
    if (originalError) {
      this.cause = originalError;
    }
  }
}

export class ConfigurationError extends CheckOpsError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
  }
}

export class RateLimitError extends CheckOpsError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
  }
}

export const handleAsyncError = (error: unknown): never => {
  if (error instanceof CheckOpsError) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new CheckOpsError(error.message, 'UNKNOWN_ERROR');
  }
  
  throw new CheckOpsError('An unknown error occurred', 'UNKNOWN_ERROR');
};

export const createErrorResponse = (error: CheckOpsError) => {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error instanceof ValidationError ? error.details : undefined
    }
  };
};

export const createSuccessResponse = (data?: any, message?: string) => {
  return {
    success: true,
    data,
    message
  };
};