/**
 * Phase 3.2: Optimized Validation Pipeline
 * Single-pass validation and sanitization for better performance
 */

import { sanitizeString, sanitizeObject } from './sanitization.js';
import { OptionUtils } from './optionUtils.js';
import { ValidationError } from './errors.js';

/**
 * Combined validation and sanitization in a single pass
 * More efficient than separate validation and sanitization steps
 */
export function validateAndSanitizeString(value, name, minLength = 0, maxLength = Infinity) {
    if (value === null || value === undefined) {
        if (minLength > 0) {
            throw new ValidationError(`${name} is required`);
        }
        return '';
    }

    // Single pass: convert to string, sanitize, and validate
    const sanitized = sanitizeString(String(value));

    if (sanitized.length === 0 && minLength > 0) {
        throw new ValidationError(`${name} is required`);
    }

    if (sanitized.length < minLength || sanitized.length > maxLength) {
        throw new ValidationError(
            `${name} must be between ${minLength} and ${maxLength} characters`
        );
    }

    return sanitized;
}

/**
 * Optimized form input validation and sanitization
 * Processes all fields in a single pass with early validation
 */
export function validateAndSanitizeFormInput({ title, description, questions, metadata }) {
    const errors = [];
    const sanitized = {};

    // Validate and sanitize title
    try {
        sanitized.title = validateAndSanitizeString(title, 'Title', 1, 255);
    } catch (error) {
        errors.push(error.message);
    }

    // Validate and sanitize description
    try {
        sanitized.description = validateAndSanitizeString(description, 'Description', 0, 5000);
    } catch (error) {
        errors.push(error.message);
    }

    // Validate and sanitize questions
    try {
        sanitized.questions = validateAndSanitizeQuestions(questions);
    } catch (error) {
        errors.push(error.message);
    }

    // Validate and sanitize metadata
    try {
        sanitized.metadata = metadata ? sanitizeObject(metadata) : {};
    } catch (error) {
        errors.push(error.message);
    }

    // Throw all errors at once if any exist
    if (errors.length > 0) {
        throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }

    return sanitized;
}

/**
 * Optimized question validation and sanitization
 * Validates question structure and options in a single pass
 */
export function validateAndSanitizeQuestions(questions) {
    if (!Array.isArray(questions)) {
        throw new ValidationError('Questions must be an array');
    }

    if (questions.length === 0) {
        throw new ValidationError('At least one question is required');
    }

    return questions.map((question, index) => {
        try {
            return validateAndSanitizeQuestion(question);
        } catch (error) {
            throw new ValidationError(`Question ${index + 1}: ${error.message}`);
        }
    });
}

/**
 * Single-pass question validation and sanitization
 */
export function validateAndSanitizeQuestion(question) {
    const errors = [];
    const sanitized = {};

    // Validate and sanitize question text
    try {
        sanitized.questionText = validateAndSanitizeString(
            question.questionText,
            'Question text',
            1,
            1000
        );
    } catch (error) {
        errors.push(error.message);
    }

    // Validate question type
    const validTypes = ['text', 'number', 'email', 'select', 'multiselect', 'radio', 'checkbox', 'textarea'];
    if (!question.questionType || !validTypes.includes(question.questionType)) {
        errors.push(`Question type must be one of: ${validTypes.join(', ')}`);
    } else {
        sanitized.questionType = question.questionType;
    }

    // Validate and sanitize options for option-based questions
    if (OptionUtils.requiresOptions(question.questionType)) {
        try {
            sanitized.options = validateAndSanitizeOptions(question.options);
        } catch (error) {
            errors.push(error.message);
        }
    } else {
        sanitized.options = question.options || null;
    }

    // Validate and sanitize validation rules
    if (question.validationRules) {
        try {
            sanitized.validationRules = sanitizeObject(question.validationRules);
        } catch (error) {
            errors.push(error.message);
        }
    } else {
        sanitized.validationRules = null;
    }

    // Set other properties
    sanitized.required = Boolean(question.required);
    sanitized.metadata = question.metadata ? sanitizeObject(question.metadata) : {};

    // Throw all errors at once if any exist
    if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
    }

    return sanitized;
}

/**
 * Optimized options validation and sanitization
 */
export function validateAndSanitizeOptions(options) {
    if (!Array.isArray(options) || options.length === 0) {
        throw new ValidationError('Options are required for this question type');
    }

    const seenKeys = new Set();
    const seenLabels = new Set();

    return options.map((option, index) => {
        if (typeof option === 'string') {
            // Convert string to option object
            const key = OptionUtils.generateOptionKey(option, index, 'question');

            if (seenKeys.has(key)) {
                throw new ValidationError(`Duplicate option key: ${key}`);
            }
            if (seenLabels.has(option)) {
                throw new ValidationError(`Duplicate option label: ${option}`);
            }

            seenKeys.add(key);
            seenLabels.add(option);

            return {
                key,
                label: sanitizeString(option),
                metadata: {}
            };
        }

        if (typeof option === 'object' && option !== null) {
            const sanitizedKey = sanitizeString(option.key || '');
            const sanitizedLabel = sanitizeString(option.label || '');

            if (!sanitizedKey || !sanitizedLabel) {
                throw new ValidationError(`Option ${index + 1}: Both key and label are required`);
            }

            if (seenKeys.has(sanitizedKey)) {
                throw new ValidationError(`Duplicate option key: ${sanitizedKey}`);
            }
            if (seenLabels.has(sanitizedLabel)) {
                throw new ValidationError(`Duplicate option label: ${sanitizedLabel}`);
            }

            seenKeys.add(sanitizedKey);
            seenLabels.add(sanitizedLabel);

            return {
                key: sanitizedKey,
                label: sanitizedLabel,
                metadata: option.metadata ? sanitizeObject(option.metadata) : {}
            };
        }

        throw new ValidationError(`Option ${index + 1}: Invalid option format`);
    });
}

/**
 * Optimized submission data validation
 * Validates against form questions in a single pass
 */
export function validateAndSanitizeSubmissionData(submissionData, questions) {
    const errors = [];
    const sanitized = {};

    // Create a map of questions for efficient lookup
    const questionMap = new Map();
    questions.forEach(question => {
        const questionId = question.questionId || question.id;
        questionMap.set(questionId, question);
    });

    // Validate each answer
    for (const [questionId, answer] of Object.entries(submissionData)) {
        const question = questionMap.get(questionId);

        if (!question) {
            errors.push(`Unknown question ID: ${questionId}`);
            continue;
        }

        try {
            sanitized[questionId] = validateAndSanitizeAnswer(answer, question);
        } catch (error) {
            errors.push(`Question "${question.questionText}": ${error.message}`);
        }
    }

    // Check for required questions
    questions.forEach(question => {
        const questionId = question.questionId || question.id;
        if (question.required && (!submissionData.hasOwnProperty(questionId) ||
            submissionData[questionId] === null ||
            submissionData[questionId] === undefined ||
            submissionData[questionId] === '')) {
            errors.push(`Question "${question.questionText}" is required`);
        }
    });

    // Throw all errors at once if any exist
    if (errors.length > 0) {
        throw new ValidationError(`Submission validation failed: ${errors.join(', ')}`);
    }

    return sanitized;
}

/**
 * Validate and sanitize a single answer
 */
export function validateAndSanitizeAnswer(answer, question) {
    // Handle empty answers
    if (answer === null || answer === undefined || answer === '') {
        return answer;
    }

    const questionType = question.questionType;

    switch (questionType) {
        case 'text':
        case 'textarea':
            return validateAndSanitizeString(answer, 'Answer', 0, 5000);

        case 'number':
            const num = Number(answer);
            if (isNaN(num)) {
                throw new ValidationError('Answer must be a valid number');
            }
            return num;

        case 'email':
            const email = validateAndSanitizeString(answer, 'Email', 1, 255);
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new ValidationError('Answer must be a valid email address');
            }
            return email.toLowerCase();

        case 'select':
        case 'radio':
            // Convert to key if it's a valid label or key
            const convertedAnswer = OptionUtils.convertToKeys(answer, question.options);
            if (convertedAnswer === answer && !question.options.some(opt => opt.key === answer)) {
                throw new ValidationError('Answer must be a valid option');
            }
            return convertedAnswer;

        case 'multiselect':
        case 'checkbox':
            if (!Array.isArray(answer)) {
                throw new ValidationError('Answer must be an array for multi-select questions');
            }
            // Convert each answer to key if it's a valid label or key
            const convertedAnswers = OptionUtils.convertToKeys(answer, question.options);
            return convertedAnswers;

        default:
            return sanitizeString(String(answer));
    }
}

/**
 * Batch validation for multiple forms
 * More efficient than validating forms individually
 */
export function validateAndSanitizeFormsData(formsData) {
    if (!Array.isArray(formsData)) {
        throw new ValidationError('Forms data must be an array');
    }

    const results = [];
    const errors = [];

    formsData.forEach((formData, index) => {
        try {
            results.push(validateAndSanitizeFormInput(formData));
        } catch (error) {
            errors.push(`Form ${index + 1}: ${error.message}`);
        }
    });

    if (errors.length > 0) {
        throw new ValidationError(`Batch validation failed: ${errors.join('; ')}`);
    }

    return results;
}