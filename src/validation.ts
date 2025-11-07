import { ConfigurationError } from './errors.js';
import type {
  CustomValidator,
  FormFieldSchema,
  FormSchema,
  ValidationErrorDetail,
  ValidationResult
} from './types.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s().-]{7,}$/;
const URL_PROTOCOLS = ['http:', 'https:'];

const TRUTHY_STRINGS = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSY_STRINGS = new Set(['false', '0', 'no', 'n', 'off']);

interface NormalizedValueResult {
  value?: unknown;
  errors: ValidationErrorDetail[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
};

const getFieldKey = (field: FormFieldSchema, formId: string): string => {
  const key = field.name ?? field.id;
  if (!key) {
    throw new ConfigurationError(`Field definition in form "${formId}" is missing both name and id.`);
  }
  return key;
};

const pickIncomingValue = (
  payload: Record<string, unknown>,
  field: FormFieldSchema,
  resolvedKey: string
): unknown => {
  if (resolvedKey in payload) {
    return payload[resolvedKey];
  }

  if (field.id && field.id !== resolvedKey && field.id in payload) {
    return payload[field.id];
  }

  if (field.name && field.name !== resolvedKey && field.name in payload) {
    return payload[field.name];
  }

  return undefined;
};

const toRegExp = (pattern: RegExp | string): RegExp => {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  return new RegExp(pattern);
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

const formatDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const runCustomValidator = async (
  validator: CustomValidator | undefined,
  value: unknown,
  field: FormFieldSchema,
  payload: Record<string, unknown>
): Promise<string | void> => {
  if (!validator) {
    return undefined;
  }

  const result = validator(value, field, payload);
  if (result instanceof Promise) {
    return result;
  }

  return result;
};

const normalizeValue = async (
  field: FormFieldSchema,
  rawValue: unknown,
  payload: Record<string, unknown>
): Promise<NormalizedValueResult> => {
  const errors: ValidationErrorDetail[] = [];

  const pushError = (code: ValidationErrorDetail['code'], message: string, value: unknown = rawValue) => {
    errors.push({ field: field.name ?? field.id ?? 'unknown', code, message, value });
  };

  const ensureOption = (value: string | string[]): void => {
    if (!field.options || field.options.length === 0) {
      return;
    }

    const allowed = new Set(field.options.map((opt) => opt.value));

    if (Array.isArray(value)) {
      const invalid = value.filter((entry) => !allowed.has(entry));
      if (invalid.length > 0) {
        pushError('option', `Value contains options that are not allowed: ${invalid.join(', ')}`, value);
      }
      return;
    }

    if (!allowed.has(value)) {
      pushError('option', `Value "${value}" is not one of the allowed options.`, value);
    }
  };

  const enforceMin = (numeric: number) => {
    if (typeof field.min === 'number' && numeric < field.min) {
      pushError('min', `Value must be greater than or equal to ${field.min}.`, numeric);
    }
  };

  const enforceMax = (numeric: number) => {
    if (typeof field.max === 'number' && numeric > field.max) {
      pushError('max', `Value must be less than or equal to ${field.max}.`, numeric);
    }
  };

  const enforceLengthBounds = (text: string) => {
    const minLength = field.minLength ?? field.min;
    if (typeof minLength === 'number' && text.length < minLength) {
      pushError('minLength', `Text must be at least ${minLength} characters long.`, text);
    }

    const maxLength = field.maxLength ?? field.max;
    if (typeof maxLength === 'number' && text.length > maxLength) {
      pushError('maxLength', `Text must be at most ${maxLength} characters long.`, text);
    }
  };

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const value = coerceString(rawValue);
      if (value === undefined) {
        pushError('type', 'Value must be a string.');
        break;
      }

      enforceLengthBounds(value);

      if (field.pattern) {
        const regex = toRegExp(field.pattern);
        if (!regex.test(value)) {
          pushError('pattern', 'Value does not match the required pattern.');
        }
      }

      return { value, errors };
    }

    case 'email': {
      const value = coerceString(rawValue);
      if (!value) {
        pushError('type', 'Value must be a string.');
        break;
      }

      if (!EMAIL_REGEX.test(value)) {
        pushError('format', 'Value must be a valid email address.', value);
      }

      enforceLengthBounds(value);
      return { value, errors };
    }

    case 'url': {
      const value = coerceString(rawValue);
      if (!value) {
        pushError('type', 'Value must be a string.');
        break;
      }

      try {
        const parsed = new URL(value);
        if (!URL_PROTOCOLS.includes(parsed.protocol)) {
          pushError('format', 'URL protocol must be http or https.', value);
        }
      } catch (error) {
        pushError('format', 'Value must be a valid URL.', value);
      }

      return { value, errors };
    }

    case 'phone': {
      const value = coerceString(rawValue);
      if (!value) {
        pushError('type', 'Value must be a string.');
        break;
      }

      if (!PHONE_REGEX.test(value)) {
        pushError('format', 'Value must be a valid phone number.', value);
      }

      return { value, errors };
    }

    case 'number':
    case 'integer': {
      const numeric =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string'
          ? Number(rawValue)
          : undefined;

      if (numeric === undefined || Number.isNaN(numeric)) {
        pushError('type', 'Value must be a number.');
        break;
      }

      enforceMin(numeric);
      enforceMax(numeric);

      if (field.type === 'integer' && !Number.isInteger(numeric)) {
        pushError('type', 'Value must be an integer.');
      }

      return { value: numeric, errors };
    }

    case 'boolean': {
      if (typeof rawValue === 'boolean') {
        return { value: rawValue, errors };
      }

      if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        if (TRUTHY_STRINGS.has(normalized)) {
          return { value: true, errors };
        }
        if (FALSY_STRINGS.has(normalized)) {
          return { value: false, errors };
        }
      }

      if (typeof rawValue === 'number') {
        if (rawValue === 1) {
          return { value: true, errors };
        }
        if (rawValue === 0) {
          return { value: false, errors };
        }
      }

      pushError('type', 'Value must be a boolean.');
      break;
    }

    case 'date':
    case 'datetime': {
      let date: Date | undefined;
      if (rawValue instanceof Date) {
        date = rawValue;
      } else if (typeof rawValue === 'string' || typeof rawValue === 'number') {
        const parsed = new Date(rawValue);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }

      if (!date) {
        pushError('type', 'Value must be a valid date.');
        break;
      }

      const iso = field.type === 'date' ? formatDateOnly(date) : date.toISOString();
      return { value: iso, errors };
    }

    case 'select': {
      const value = coerceString(rawValue);
      if (value === undefined) {
        pushError('type', 'Value must be a string.');
        break;
      }

      ensureOption(value);
      return { value, errors };
    }

    case 'multi-select': {
      const arr = Array.isArray(rawValue)
        ? rawValue.map(coerceString).filter((val): val is string => Boolean(val))
        : typeof rawValue === 'string'
        ? rawValue
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : undefined;

      if (!arr) {
        pushError('type', 'Value must be an array of strings.');
        break;
      }

      ensureOption(arr);
      return { value: arr, errors };
    }

    case 'json': {
      if (isPlainObject(rawValue) || Array.isArray(rawValue)) {
        return { value: rawValue, errors };
      }

      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          return { value: parsed, errors };
        } catch (parseError) {
          pushError('format', 'Value must be valid JSON.', rawValue);
          break;
        }
      }

      pushError('type', 'Value must be an object, array, or JSON string.');
      break;
    }

    default: {
      pushError('unknown', `Unsupported field type "${field.type}".`);
    }
  }

  return { errors };
};

export const validateFormData = async (
  schema: FormSchema,
  payload: Record<string, unknown>
): Promise<ValidationResult> => {
  if (!schema || !Array.isArray(schema.fields)) {
    throw new ConfigurationError('Form schema is invalid: expected a list of fields.');
  }

  const errors: ValidationErrorDetail[] = [];
  const warnings: string[] = [];
  const normalized: Record<string, unknown> = {};
  const seenKeys = new Set<string>();

  for (const field of schema.fields) {
    const key = getFieldKey(field, schema.id);
    seenKeys.add(key);

    const incoming = pickIncomingValue(payload, field, key);

    if (isEmpty(incoming)) {
      if (field.defaultValue !== undefined) {
        normalized[key] = field.defaultValue;
      } else if (field.required) {
        errors.push({
          field: key,
          code: 'required',
          message: 'This field is required.'
        });
      }
      continue;
    }

    const { value, errors: fieldErrors } = await normalizeValue(field, incoming, payload);

    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
      continue;
    }

    const validatorMessage = await runCustomValidator(field.validator, value, field, payload);
    if (validatorMessage) {
      errors.push({
        field: key,
        code: 'custom',
        message: validatorMessage,
        value
      });
      continue;
    }

    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  for (const key of Object.keys(payload)) {
    if (!seenKeys.has(key)) {
      warnings.push(`Unexpected field "${key}" was provided and has been ignored.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: normalized,
    warnings
  };
};
