import { ValidationError } from './errors.js';
import { OptionUtils } from './optionUtils.js';

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone);
}

export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateQuestionType(type) {
  const validTypes = [
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'select',
    'multiselect',
    'radio',
    'checkbox',
    'boolean',
    'file',
    'rating',
  ];
  return validTypes.includes(type);
}

export function validateRequired(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateString(value, fieldName, minLength = 0, maxLength = Infinity) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must not exceed ${maxLength} characters`);
  }
}

export function validateNumber(value, fieldName, min = -Infinity, max = Infinity) {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }

  if (num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (num > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max}`);
  }

  return num;
}

export function validateArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
}

export function validateObject(value, fieldName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`);
  }
}

export function validateBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean`);
  }
}

export function validateQuestion(question) {
  validateRequired(question, 'Question');
  validateObject(question, 'Question');

  if (!question.questionId && !question.questionText) {
    throw new ValidationError('Question must have either questionId or questionText');
  }

  if (question.questionText) {
    validateString(question.questionText, 'questionText', 1, 5000);
  }

  if (question.questionType) {
    if (!validateQuestionType(question.questionType)) {
      throw new ValidationError(`Invalid question type: ${question.questionType}`);
    }
  }

  if (question.required !== undefined) {
    validateBoolean(question.required, 'required');
  }

  if (question.options !== undefined && question.options !== null) {
    validateArray(question.options, 'options');
  }

  if (question.validationRules !== undefined && question.validationRules !== null) {
    validateObject(question.validationRules, 'validationRules');
  }
}

export function validateQuestions(questions) {
  validateRequired(questions, 'Questions');
  validateArray(questions, 'Questions');

  if (questions.length === 0) {
    throw new ValidationError('Form must have at least one question');
  }

  questions.forEach((question, index) => {
    try {
      validateQuestion(question);
    } catch (error) {
      throw new ValidationError(`Question at index ${index}: ${error.message}`);
    }
  });
}

export function validateSubmissionData(submissionData, formQuestions) {
  validateRequired(submissionData, 'Submission data');
  validateObject(submissionData, 'Submission data');

  const errors = [];

  formQuestions.forEach((question) => {
    const questionId = question.questionId || question.id;
    const answer = submissionData[questionId];

    if (question.required && (answer === undefined || answer === null || answer === '')) {
      errors.push(`Answer for question '${questionId}' is required`);
      return;
    }

    if (answer === undefined || answer === null || answer === '') {
      return;
    }

    const validationRules = question.validationRules || {};

    if (question.questionType === 'email' && !validateEmail(answer)) {
      errors.push(`Invalid email format for question '${questionId}'`);
    }

    if (question.questionType === 'phone' && !validatePhone(answer)) {
      errors.push(`Invalid phone format for question '${questionId}'`);
    }

    if (question.questionType === 'number') {
      try {
        const min = validationRules.min ?? -Infinity;
        const max = validationRules.max ?? Infinity;
        validateNumber(answer, questionId, min, max);
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (question.questionType === 'text' || question.questionType === 'textarea') {
      if (typeof answer !== 'string') {
        errors.push(`Answer for question '${questionId}' must be a string`);
      } else {
        const minLength = validationRules.minLength || 0;
        const maxLength = validationRules.maxLength || Infinity;
        if (answer.length < minLength) {
          errors.push(`Answer for question '${questionId}' must be at least ${minLength} characters`);
        }
        if (answer.length > maxLength) {
          errors.push(`Answer for question '${questionId}' must not exceed ${maxLength} characters`);
        }
      }
    }

    if (question.options && OptionUtils.requiresOptions(question.questionType)) {
      if (!OptionUtils.isValidAnswer(answer, question.options, question.questionType)) {
        if (question.questionType === 'multiselect' || question.questionType === 'checkbox') {
          if (!Array.isArray(answer)) {
            errors.push(`Answer for question '${questionId}' must be an array`);
          } else {
            errors.push(`Invalid options selected for question '${questionId}'`);
          }
        } else {
          errors.push(`Invalid option selected for question '${questionId}'`);
        }
      }
    }
  });

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}
