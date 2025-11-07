import { ConfigurationError, ValidationError } from './errors.js';
import { httpRequest } from './httpClient.js';
import { validateFormData } from './validation.js';
import type {
  FormBuilderSubmissionSDKConfig,
  FormSchema,
  SubmissionBuildResult,
  SubmissionOptions,
  SubmissionPayload,
  SubmissionPayloadOptions,
  SubmitResult,
  ValidationResult
} from './types.js';

const DEFAULT_TIMEOUT = 10_000;

const normalizeBaseUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ConfigurationError('Base URL must be a non-empty string.');
  }

  const sanitized = trimmed.replace(/\/+$/, '');
  try {
    void new URL(sanitized);
  } catch (error) {
    throw new ConfigurationError('Base URL must be a valid absolute URL.', { cause: error });
  }

  return sanitized;
};

const normalizeHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!key) {
      continue;
    }
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
};

const encodeFormId = (formId: string): string => encodeURIComponent(formId);

export class FormBuilderSubmissionSDK {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly fetchImpl?: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly source?: string;

  constructor(config: FormBuilderSubmissionSDKConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.fetchImpl = config.fetch;
    this.source = config.source;
    this.defaultHeaders = normalizeHeaders({
      accept: 'application/json',
      'content-type': 'application/json',
      ...(config.defaultHeaders ?? {})
    });

    if (this.timeout <= 0) {
      throw new ConfigurationError('Timeout must be greater than zero.');
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getTimeout(): number {
    return this.timeout;
  }

  public async validate(schema: FormSchema, data: Record<string, unknown>): Promise<ValidationResult> {
    return validateFormData(schema, data);
  }

  public async buildSubmission(
    schema: FormSchema,
    data: Record<string, unknown>,
    options: SubmissionPayloadOptions = {}
  ): Promise<SubmissionBuildResult> {
    const validation = await this.validate(schema, data);

    if (!validation.isValid) {
      throw new ValidationError('Form submission is invalid.', validation.errors, validation.warnings);
    }

    const payload: SubmissionPayload = {
      formId: schema.id,
      version: schema.version,
      submittedAt: options.submittedAt ?? new Date().toISOString(),
      data: validation.data
    };

    if (options.metadata) {
      payload.metadata = { ...options.metadata };
    }

    const source = options.source ?? this.source;
    if (source) {
      payload.source = source;
    }

    return {
      payload,
      validation
    };
  }

  public async submit<T = unknown>(
    schema: FormSchema,
    data: Record<string, unknown>,
    options: SubmissionOptions<T> = {}
  ): Promise<SubmitResult<T>> {
    const submission = await this.buildSubmission(schema, data, options);

    if (options.dryRun) {
      return {
        payload: submission.payload,
        validation: submission.validation,
        dryRun: true
      };
    }

    const url = `${this.baseUrl}/forms/${encodeFormId(schema.id)}/submissions`;
    const headers = this.buildHeaders(options.headers);

    const response = await httpRequest<unknown>({
      url,
      method: 'POST',
      headers,
      body: submission.payload,
      timeout: options.timeout ?? this.timeout,
      fetchImpl: this.fetchImpl,
      signal: options.signal
    });

    const dataPayload = (options.transform ? options.transform(response.data) : (response.data as T)) as T;

    return {
      payload: submission.payload,
      validation: submission.validation,
      response: {
        status: response.status,
        data: dataPayload,
        headers: response.headers
      },
      dryRun: false
    };
  }

  public async submitPayload<T = unknown>(
    formId: string,
    payload: SubmissionPayload,
    options: SubmissionOptions<T> = {}
  ): Promise<SubmitResult<T>> {
    if (!formId) {
      throw new ConfigurationError('formId must not be empty.');
    }

    const url = `${this.baseUrl}/forms/${encodeFormId(formId)}/submissions`;
    const headers = this.buildHeaders(options.headers);

    if (options.dryRun) {
      return {
        payload,
        validation: {
          isValid: true,
          errors: [],
          data: payload.data,
          warnings: []
        },
        dryRun: true
      };
    }

    const response = await httpRequest<unknown>({
      url,
      method: 'POST',
      headers,
      body: payload,
      timeout: options.timeout ?? this.timeout,
      fetchImpl: this.fetchImpl,
      signal: options.signal
    });

    const dataPayload = (options.transform ? options.transform(response.data) : (response.data as T)) as T;

    return {
      payload,
      validation: {
        isValid: true,
        errors: [],
        data: payload.data,
        warnings: []
      },
      response: {
        status: response.status,
        data: dataPayload,
        headers: response.headers
      },
      dryRun: false
    };
  }

  private buildHeaders(headers?: Record<string, string>): Record<string, string> {
    const merged = normalizeHeaders({
      ...this.defaultHeaders,
      ...(headers ?? {})
    });

    if (this.apiKey && !merged.authorization) {
      merged.authorization = `Bearer ${this.apiKey}`;
    }

    return merged;
  }
}

export * from './types.js';
export * from './errors.js';
export { validateFormData } from './validation.js';
export { httpRequest } from './httpClient.js';
