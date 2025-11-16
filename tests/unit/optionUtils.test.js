import { OptionUtils } from '../../src/utils/optionUtils.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('OptionUtils', () => {
  describe('processOptions', () => {
    test('should process simple string array into structured options', () => {
      const options = ['Red', 'Blue', 'Green'];
      const result = OptionUtils.processOptions(options, 'Q-001');

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('key');
      expect(result[0]).toHaveProperty('label', 'Red');
      expect(result[0]).toHaveProperty('order', 1);
      expect(result[0]).toHaveProperty('metadata');
      expect(result[0]).toHaveProperty('disabled', false);
      expect(result[0]).toHaveProperty('createdAt');
    });

    test('should accept pre-structured options', () => {
      const options = [
        { key: 'color_red', label: 'Red' },
        { key: 'color_blue', label: 'Blue' },
      ];
      const result = OptionUtils.processOptions(options, 'Q-001');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('color_red');
      expect(result[0].label).toBe('Red');
    });

    test('should reject duplicate keys', () => {
      const options = [
        { key: 'same_key', label: 'Red' },
        { key: 'same_key', label: 'Blue' },
      ];

      expect(() => {
        OptionUtils.processOptions(options, 'Q-001');
      }).toThrow(ValidationError);
      expect(() => {
        OptionUtils.processOptions(options, 'Q-001');
      }).toThrow('Option keys must be unique');
    });

    test('should return null for null input', () => {
      const result = OptionUtils.processOptions(null, 'Q-001');
      expect(result).toBeNull();
    });

    test('should return empty array for empty input', () => {
      const result = OptionUtils.processOptions([], 'Q-001');
      expect(result).toEqual([]);
    });

    test('should throw error for non-array input', () => {
      expect(() => {
        OptionUtils.processOptions('not an array', 'Q-001');
      }).toThrow(ValidationError);
    });

    test('should throw error for mixed array types', () => {
      const options = ['Red', { key: 'color_blue', label: 'Blue' }];

      expect(() => {
        OptionUtils.processOptions(options, 'Q-001');
      }).toThrow(ValidationError);
    });
  });

  describe('generateOptionKey', () => {
    test('should generate unique key from label', () => {
      const key = OptionUtils.generateOptionKey('High Priority', 0, 'Q-001');

      expect(key).toMatch(/^opt_high_priority_[a-f0-9]{6}$/);
    });

    test('should handle special characters in label', () => {
      const key = OptionUtils.generateOptionKey('Red & Blue!', 0, 'Q-001');

      expect(key).toMatch(/^opt_red_blue_[a-f0-9]{6}$/);
    });

    test('should truncate long labels', () => {
      const longLabel = 'This is a very long label that should be truncated to 30 characters maximum';
      const key = OptionUtils.generateOptionKey(longLabel, 0, 'Q-001');

      const slug = key.replace(/^opt_/, '').replace(/_[a-f0-9]{6}$/, '');
      expect(slug.length).toBeLessThanOrEqual(30);
    });
  });

  describe('sanitizeOptionKey', () => {
    test('should accept valid keys', () => {
      const key = 'opt_red_abc123';
      const result = OptionUtils.sanitizeOptionKey(key);
      expect(result).toBe(key);
    });

    test('should trim whitespace', () => {
      const key = '  opt_red_abc123  ';
      const result = OptionUtils.sanitizeOptionKey(key);
      expect(result).toBe('opt_red_abc123');
    });

    test('should reject empty keys', () => {
      expect(() => {
        OptionUtils.sanitizeOptionKey('');
      }).toThrow(ValidationError);
    });

    test('should reject keys with invalid characters', () => {
      expect(() => {
        OptionUtils.sanitizeOptionKey('opt red abc');
      }).toThrow(ValidationError);
    });

    test('should reject keys longer than 100 characters', () => {
      const longKey = 'a'.repeat(101);
      expect(() => {
        OptionUtils.sanitizeOptionKey(longKey);
      }).toThrow(ValidationError);
    });
  });

  describe('findOption', () => {
    const options = [
      { key: 'color_red', label: 'Red' },
      { key: 'color_blue', label: 'Blue' },
    ];

    test('should find option by key', () => {
      const result = OptionUtils.findOption(options, 'color_red');
      expect(result).toEqual(options[0]);
    });

    test('should find option by label', () => {
      const result = OptionUtils.findOption(options, 'Blue');
      expect(result).toEqual(options[1]);
    });

    test('should return null if not found', () => {
      const result = OptionUtils.findOption(options, 'Green');
      expect(result).toBeNull();
    });

    test('should return null for null options', () => {
      const result = OptionUtils.findOption(null, 'Red');
      expect(result).toBeNull();
    });
  });

  describe('convertToKeys', () => {
    const options = [
      { key: 'color_red', label: 'Red' },
      { key: 'color_blue', label: 'Blue' },
    ];

    test('should convert label to key', () => {
      const result = OptionUtils.convertToKeys('Red', options);
      expect(result).toBe('color_red');
    });

    test('should keep key as key', () => {
      const result = OptionUtils.convertToKeys('color_blue', options);
      expect(result).toBe('color_blue');
    });

    test('should convert array of labels to keys', () => {
      const result = OptionUtils.convertToKeys(['Red', 'Blue'], options);
      expect(result).toEqual(['color_red', 'color_blue']);
    });

    test('should handle mixed keys and labels in array', () => {
      const result = OptionUtils.convertToKeys(['Red', 'color_blue'], options);
      expect(result).toEqual(['color_red', 'color_blue']);
    });

    test('should return unchanged for unknown value', () => {
      const result = OptionUtils.convertToKeys('Unknown', options);
      expect(result).toBe('Unknown');
    });

    test('should return empty string for empty input', () => {
      const result = OptionUtils.convertToKeys('', options);
      expect(result).toBe('');
    });

    test('should return null for null input', () => {
      const result = OptionUtils.convertToKeys(null, options);
      expect(result).toBeNull();
    });
  });

  describe('convertToLabels', () => {
    const options = [
      { key: 'color_red', label: 'Red' },
      { key: 'color_blue', label: 'Blue' },
    ];

    test('should convert key to label', () => {
      const result = OptionUtils.convertToLabels('color_red', options);
      expect(result).toBe('Red');
    });

    test('should keep label as label', () => {
      const result = OptionUtils.convertToLabels('Blue', options);
      expect(result).toBe('Blue');
    });

    test('should convert array of keys to labels', () => {
      const result = OptionUtils.convertToLabels(['color_red', 'color_blue'], options);
      expect(result).toEqual(['Red', 'Blue']);
    });

    test('should return unchanged for unknown key', () => {
      const result = OptionUtils.convertToLabels('unknown_key', options);
      expect(result).toBe('unknown_key');
    });

    test('should return empty string for empty input', () => {
      const result = OptionUtils.convertToLabels('', options);
      expect(result).toBe('');
    });
  });

  describe('requiresOptions', () => {
    test('should return true for select', () => {
      expect(OptionUtils.requiresOptions('select')).toBe(true);
    });

    test('should return true for multiselect', () => {
      expect(OptionUtils.requiresOptions('multiselect')).toBe(true);
    });

    test('should return true for radio', () => {
      expect(OptionUtils.requiresOptions('radio')).toBe(true);
    });

    test('should return true for checkbox', () => {
      expect(OptionUtils.requiresOptions('checkbox')).toBe(true);
    });

    test('should return false for text', () => {
      expect(OptionUtils.requiresOptions('text')).toBe(false);
    });

    test('should return false for number', () => {
      expect(OptionUtils.requiresOptions('number')).toBe(false);
    });
  });

  describe('isValidAnswer', () => {
    const options = [
      { key: 'color_red', label: 'Red' },
      { key: 'color_blue', label: 'Blue' },
    ];

    test('should accept valid key for select', () => {
      const result = OptionUtils.isValidAnswer('color_red', options, 'select');
      expect(result).toBe(true);
    });

    test('should accept valid label for select', () => {
      const result = OptionUtils.isValidAnswer('Blue', options, 'select');
      expect(result).toBe(true);
    });

    test('should reject invalid value for select', () => {
      const result = OptionUtils.isValidAnswer('Green', options, 'select');
      expect(result).toBe(false);
    });

    test('should accept valid keys array for multiselect', () => {
      const result = OptionUtils.isValidAnswer(['color_red', 'color_blue'], options, 'multiselect');
      expect(result).toBe(true);
    });

    test('should accept mixed keys and labels for multiselect', () => {
      const result = OptionUtils.isValidAnswer(['color_red', 'Blue'], options, 'multiselect');
      expect(result).toBe(true);
    });

    test('should reject invalid value in array for multiselect', () => {
      const result = OptionUtils.isValidAnswer(['color_red', 'Green'], options, 'multiselect');
      expect(result).toBe(false);
    });

    test('should reject non-array for multiselect', () => {
      const result = OptionUtils.isValidAnswer('color_red', options, 'multiselect');
      expect(result).toBe(false);
    });

    test('should accept empty value', () => {
      expect(OptionUtils.isValidAnswer('', options, 'select')).toBe(true);
      expect(OptionUtils.isValidAnswer(null, options, 'select')).toBe(true);
      expect(OptionUtils.isValidAnswer(undefined, options, 'select')).toBe(true);
    });
  });
});
