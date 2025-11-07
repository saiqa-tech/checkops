export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'phone'
  | 'select'
  | 'multi-select'
  | 'json';

export interface FieldOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export type CustomValidator = (
  value: unknown,
  field: FormFieldSchema,
  payload: Record<string, unknown>
) => string | void | Promise<string | void>;

export interface FormFieldSchema {
  /**
   * Unique identifier for the field as defined in the Form Builder backend.
   */
  id?: string;
  /**
   * The key that will be used in the submission payload. If omitted, `id` is used.
   */
  name?: string;
  label?: string;
  description?: string;
  type: FormFieldType;
  required?: boolean;
  /**
   * Minimum length for string based fields or minimum value for numeric fields.
   */
  min?: number;
  /**
   * Maximum length for string based fields or maximum value for numeric fields.
   */
  max?: number;
  /**
   * Alias for `min` when dealing with string based fields for clarity.
   */
  minLength?: number;
  /**
   * Alias for `max` when dealing with string based fields for clarity.
   */
  maxLength?: number;
  /**
   * Regular expression pattern (either a RegExp instance or pattern string) that string fields must satisfy.
   */
  pattern?: RegExp | string;
  /**
   * Predefined options for select style fields.
   */
  options?: FieldOption[];
  /**
   * Whether select field allows multiple selections.
   */
  multiple?: boolean;
  /**
   * Default value that will be applied when the consumer does not pass a value.
   */
  defaultValue?: unknown;
  /**
   * Optional custom validator invoked after built-in validations.
   */
  validator?: CustomValidator;
}

export interface FormSchema {
  id: string;
  title?: string;
  description?: string;
  version?: string;
  fields: FormFieldSchema[];
  metadata?: Record<string, unknown>;
}

export type ValidationErrorCode =
  | 'required'
  | 'type'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'option'
  | 'custom'
  | 'format'
  | 'unknown';

export interface ValidationErrorDetail {
  field: string;
  code: ValidationErrorCode;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  data: Record<string, unknown>;
  warnings: string[];
}

export interface SubmissionMetadata {
  submittedBy?: string;
  submittedAt?: string;
  locale?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface SubmissionPayload {
  formId: string;
  version?: string;
  submittedAt: string;
  data: Record<string, unknown>;
  metadata?: SubmissionMetadata;
  source?: string;
}

export interface SubmissionPayloadOptions {
  metadata?: SubmissionMetadata;
  submittedAt?: string;
  source?: string;
}

export interface SubmissionOptions<TResponse = unknown> extends SubmissionPayloadOptions {
  headers?: Record<string, string>;
  timeout?: number;
  dryRun?: boolean;
  signal?: AbortSignal;
  /**
   * Optional parser to convert the JSON response into a desired shape.
   */
  transform?: (payload: unknown) => TResponse;
}

export interface HttpRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export interface SubmissionBuildResult {
  payload: SubmissionPayload;
  validation: ValidationResult;
}

export interface SubmitResult<T = unknown> {
  payload: SubmissionPayload;
  validation: ValidationResult;
  response?: HttpResponse<T>;
  dryRun: boolean;
}

export interface FormBuilderSubmissionSDKConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  source?: string;
}
