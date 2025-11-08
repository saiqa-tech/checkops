export class CheckOpsError extends Error {
  constructor(message, code = 'CHECKOPS_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CheckOpsError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class NotFoundError extends CheckOpsError {
  constructor(resource, id) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND');
    this.resource = resource;
    this.id = id;
  }
}

export class DatabaseError extends CheckOpsError {
  constructor(message, originalError = null) {
    super(message, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

export class DuplicateError extends CheckOpsError {
  constructor(resource, field) {
    super(`${resource} with this ${field} already exists`, 'DUPLICATE_ERROR');
    this.resource = resource;
    this.field = field;
  }
}

export class InvalidOperationError extends CheckOpsError {
  constructor(message) {
    super(message, 'INVALID_OPERATION');
  }
}
