import crypto from 'crypto';
import { ValidationError } from './errors.js';

export class OptionUtils {
  static processOptions(options, questionId) {
    if (!options) {
      return null;
    }

    if (!Array.isArray(options)) {
      throw new ValidationError('Options must be an array');
    }

    if (options.length === 0) {
      return [];
    }

    const isSimpleArray = options.every((opt) => typeof opt === 'string');

    if (isSimpleArray) {
      return options.map((label, index) => ({
        key: this.generateOptionKey(label, index, questionId),
        label: label,
        order: index + 1,
        metadata: {},
        disabled: false,
        createdAt: new Date().toISOString(),
      }));
    }

    const isStructuredArray = options.every(
      (opt) => typeof opt === 'object' && opt !== null && opt.key && opt.label
    );

    if (!isStructuredArray) {
      throw new ValidationError(
        'Options must be either all strings or all objects with key and label properties'
      );
    }

    const keys = options.map((opt) => opt.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      throw new ValidationError('Option keys must be unique within a question');
    }

    return options.map((opt, index) => ({
      key: this.sanitizeOptionKey(opt.key),
      label: opt.label,
      order: opt.order !== undefined ? opt.order : index + 1,
      metadata: opt.metadata || {},
      disabled: opt.disabled || false,
      createdAt: opt.createdAt || new Date().toISOString(),
    }));
  }

  static generateOptionKey(label, index, questionId) {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 30);

    const hashInput = questionId
      ? `${questionId}_${label}_${index}`
      : `${label}_${index}_${Date.now()}`;

    const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

    return `opt_${slug}_${hash}`;
  }

  static sanitizeOptionKey(key) {
    if (typeof key !== 'string') {
      throw new ValidationError('Option key must be a string');
    }

    const sanitized = key.trim();

    if (sanitized.length === 0) {
      throw new ValidationError('Option key cannot be empty');
    }

    if (sanitized.length > 100) {
      throw new ValidationError('Option key cannot exceed 100 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      throw new ValidationError(
        'Option key can only contain alphanumeric characters, underscores, and hyphens'
      );
    }

    return sanitized;
  }

  static findOption(options, value) {
    if (!options || !Array.isArray(options)) {
      return null;
    }

    return options.find((opt) => opt.key === value || opt.label === value) || null;
  }

  static convertToKeys(answer, options) {
    if (!options || !Array.isArray(options)) {
      return answer;
    }

    if (answer === undefined || answer === null || answer === '') {
      return answer;
    }

    if (Array.isArray(answer)) {
      return answer.map((value) => {
        const option = this.findOption(options, value);
        return option ? option.key : value;
      });
    }

    const option = this.findOption(options, answer);
    return option ? option.key : answer;
  }

  static convertToLabels(answer, options) {
    if (!options || !Array.isArray(options)) {
      return answer;
    }

    if (answer === undefined || answer === null || answer === '') {
      return answer;
    }

    if (Array.isArray(answer)) {
      return answer.map((value) => {
        const option = options.find((opt) => opt.key === value);
        return option ? option.label : value;
      });
    }

    const option = options.find((opt) => opt.key === answer);
    return option ? option.label : answer;
  }

  static requiresOptions(questionType) {
    return ['select', 'multiselect', 'radio', 'checkbox'].includes(questionType);
  }

  static isValidAnswer(answer, options, questionType) {
    if (answer === undefined || answer === null || answer === '') {
      return true;
    }

    if (!options || !Array.isArray(options) || options.length === 0) {
      return false;
    }

    const validKeys = options.map((opt) => opt.key);
    const validLabels = options.map((opt) => opt.label);
    const validValues = [...validKeys, ...validLabels];

    if (questionType === 'multiselect' || questionType === 'checkbox') {
      if (!Array.isArray(answer)) {
        return false;
      }
      return answer.every((value) => validValues.includes(value));
    }

    return validValues.includes(answer);
  }
}
