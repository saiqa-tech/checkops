import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateQuestionType,
  validateRequired,
  validateString,
  validateNumber,
  validateArray,
  validateObject,
  validateBoolean,
  validateQuestion,
  validateQuestions,
  validateSubmissionData,
} from '../../../src/utils/validation.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('(555) 123-4567')).toBe(true);
    });

    it('should reject invalid phone', () => {
      expect(validatePhone('abc')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URL', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URL', () => {
      expect(validateUrl('not a url')).toBe(false);
    });
  });

  describe('validateQuestionType', () => {
    it('should validate correct question types', () => {
      expect(validateQuestionType('text')).toBe(true);
      expect(validateQuestionType('email')).toBe(true);
      expect(validateQuestionType('select')).toBe(true);
    });

    it('should reject invalid question type', () => {
      expect(validateQuestionType('invalid')).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should pass for valid values', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
      expect(() => validateRequired(0, 'field')).not.toThrow();
    });

    it('should throw for null, undefined, or empty', () => {
      expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
      expect(() => validateRequired('', 'field')).toThrow(ValidationError);
    });
  });

  describe('validateString', () => {
    it('should validate correct string', () => {
      expect(() => validateString('test', 'field', 1, 10)).not.toThrow();
    });

    it('should throw for non-string', () => {
      expect(() => validateString(123, 'field')).toThrow(ValidationError);
    });

    it('should throw for length violations', () => {
      expect(() => validateString('ab', 'field', 5, 10)).toThrow(ValidationError);
      expect(() => validateString('toolongstring', 'field', 1, 5)).toThrow(ValidationError);
    });
  });

  describe('validateNumber', () => {
    it('should validate correct number', () => {
      expect(validateNumber(5, 'field', 0, 10)).toBe(5);
      expect(validateNumber('5', 'field', 0, 10)).toBe(5);
    });

    it('should throw for invalid number', () => {
      expect(() => validateNumber('abc', 'field')).toThrow(ValidationError);
    });

    it('should throw for range violations', () => {
      expect(() => validateNumber(5, 'field', 10, 20)).toThrow(ValidationError);
      expect(() => validateNumber(25, 'field', 10, 20)).toThrow(ValidationError);
    });
  });

  describe('validateArray', () => {
    it('should validate array', () => {
      expect(() => validateArray([], 'field')).not.toThrow();
      expect(() => validateArray([1, 2, 3], 'field')).not.toThrow();
    });

    it('should throw for non-array', () => {
      expect(() => validateArray({}, 'field')).toThrow(ValidationError);
      expect(() => validateArray('string', 'field')).toThrow(ValidationError);
    });
  });

  describe('validateObject', () => {
    it('should validate object', () => {
      expect(() => validateObject({}, 'field')).not.toThrow();
      expect(() => validateObject({ key: 'value' }, 'field')).not.toThrow();
    });

    it('should throw for non-object', () => {
      expect(() => validateObject([], 'field')).toThrow(ValidationError);
      expect(() => validateObject(null, 'field')).toThrow(ValidationError);
      expect(() => validateObject('string', 'field')).toThrow(ValidationError);
    });
  });

  describe('validateBoolean', () => {
    it('should validate boolean', () => {
      expect(() => validateBoolean(true, 'field')).not.toThrow();
      expect(() => validateBoolean(false, 'field')).not.toThrow();
    });

    it('should throw for non-boolean', () => {
      expect(() => validateBoolean(1, 'field')).toThrow(ValidationError);
      expect(() => validateBoolean('true', 'field')).toThrow(ValidationError);
    });
  });

  describe('validateQuestion', () => {
    it('should validate correct question', () => {
      const question = {
        questionText: 'What is your name?',
        questionType: 'text',
        required: true,
      };
      expect(() => validateQuestion(question)).not.toThrow();
    });

    it('should throw for invalid question', () => {
      expect(() => validateQuestion({})).toThrow(ValidationError);
      expect(() => validateQuestion({ questionText: '' })).toThrow(ValidationError);
    });
  });

  describe('validateQuestions', () => {
    it('should validate array of questions', () => {
      const questions = [
        { questionText: 'Question 1', questionType: 'text' },
        { questionText: 'Question 2', questionType: 'email' },
      ];
      expect(() => validateQuestions(questions)).not.toThrow();
    });

    it('should throw for empty array', () => {
      expect(() => validateQuestions([])).toThrow(ValidationError);
    });

    it('should throw for invalid question in array', () => {
      const questions = [{ questionText: 'Valid' }, {}];
      expect(() => validateQuestions(questions)).toThrow(ValidationError);
    });
  });

  describe('validateSubmissionData', () => {
    it('should validate correct submission', () => {
      const questions = [
        { id: 'q1', questionText: 'Name', questionType: 'text', required: true },
        { id: 'q2', questionText: 'Email', questionType: 'email', required: false },
      ];
      const data = { q1: 'John Doe', q2: 'john@example.com' };

      expect(() => validateSubmissionData(data, questions)).not.toThrow();
    });

    it('should throw for missing required field', () => {
      const questions = [{ id: 'q1', questionText: 'Name', questionType: 'text', required: true }];
      const data = {};

      expect(() => validateSubmissionData(data, questions)).toThrow(ValidationError);
    });

    it('should throw for invalid email', () => {
      const questions = [{ id: 'q1', questionText: 'Email', questionType: 'email' }];
      const data = { q1: 'invalid-email' };

      expect(() => validateSubmissionData(data, questions)).toThrow(ValidationError);
    });
  });
});
