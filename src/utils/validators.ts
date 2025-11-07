import { ValidationRule } from '../types/security.types.js';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateRequired = (value: any): boolean => {
  return value !== null && value !== undefined && value !== '';
};

export const validateMinLength = (value: string, minLength: number): boolean => {
  return String(value || '').length >= minLength;
};

export const validateMaxLength = (value: string, maxLength: number): boolean => {
  return String(value || '').length <= maxLength;
};

export const validatePattern = (value: string, pattern: string): boolean => {
  const regex = new RegExp(pattern);
  return regex.test(value);
};

export const validateNumberRange = (value: number, min: number, max: number): boolean => {
  return !isNaN(value) && value >= min && value <= max;
};

export const validateDate = (value: string): boolean => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

export const applyValidationRules = async (
  data: Record<string, any>,
  rules: ValidationRule[]
): Promise<{ isValid: boolean; errors: string[]; validatedData: Record<string, any> }> => {
  const errors: string[] = [];
  const validatedData: Record<string, any> = { ...data };

  for (const rule of rules) {
    const value = data[rule.fieldId];
    let isValid = true;
    let validatedValue = value;

    switch (rule.type) {
      case 'required':
        isValid = validateRequired(value);
        break;

      case 'min_length':
        isValid = validateMinLength(String(value || ''), rule.parameters.minLength);
        break;

      case 'max_length':
        isValid = validateMaxLength(String(value || ''), rule.parameters.maxLength);
        break;

      case 'pattern':
        isValid = validatePattern(String(value || ''), rule.parameters.pattern);
        break;

      case 'email':
        isValid = validateEmail(String(value || ''));
        break;

      case 'number_range':
        isValid = validateNumberRange(Number(value), rule.parameters.min, rule.parameters.max);
        validatedValue = Number(value);
        break;

      case 'custom':
        // For custom validation, you would implement your logic here
        // For now, we'll assume it passes
        isValid = true;
        break;

      default:
        isValid = true;
        break;
    }

    if (!isValid) {
      errors.push(rule.errorMessage || `Validation failed for field ${rule.fieldId}`);
    } else {
      validatedData[rule.fieldId] = validatedValue;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedData
  };
};