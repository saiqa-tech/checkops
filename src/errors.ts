import type { ValidationErrorDetail } from './types.js';

type ErrorOptions = {
  cause?: unknown;
};

export class CheckOpsSDKError extends Error {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message);
    this.name = 'CheckOpsSDKError';
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ConfigurationError extends CheckOpsSDKError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends CheckOpsSDKError {
  public readonly details: ValidationErrorDetail[];
  public readonly warnings: string[];

  constructor(message: string, details: ValidationErrorDetail[], warnings: string[] = [], options: ErrorOptions = {}) {
    super(message, options);
    this.name = 'ValidationError';
    this.details = details;
    this.warnings = warnings;
  }
}

export type RequestErrorCode = 'timeout' | 'network' | 'http';

interface RequestErrorOptions<T = unknown> extends ErrorOptions {
  status?: number;
  response?: T;
  headers?: Headers;
  code: RequestErrorCode;
}

export class RequestError<T = unknown> extends CheckOpsSDKError {
  public readonly status?: number;
  public readonly response?: T;
  public readonly headers?: Headers;
  public readonly code: RequestErrorCode;

  constructor(message: string, options: RequestErrorOptions<T>) {
    super(message, options);
    this.name = 'RequestError';
    this.status = options.status;
    this.response = options.response;
    this.headers = options.headers;
    this.code = options.code;
  }
}
