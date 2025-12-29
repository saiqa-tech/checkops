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

    test('should generate deterministic keys (same input always produces same key)', () => {
      const key1 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');
      const key2 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');
      const key3 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    test('should generate different keys for different labels', () => {
      const key1 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');
      const key2 = OptionUtils.generateOptionKey('Blue', 0, 'Q-001');

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for same label with different indices', () => {
      const key1 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');
      const key2 = OptionUtils.generateOptionKey('Red', 1, 'Q-001');

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for same label in different questions', () => {
      const key1 = OptionUtils.generateOptionKey('Red', 0, 'Q-001');
      const key2 = OptionUtils.generateOptionKey('Red', 0, 'Q-002');

      expect(key1).not.toBe(key2);
    });

    test('should handle unicode characters', () => {
      const key = OptionUtils.generateOptionKey('日本語', 0, 'Q-001');
      // Unicode characters get stripped, leaving just the hash
      expect(key).toMatch(/^opt__[a-f0-9]{6}$/);
    });

    test('should handle emoji in labels', () => {
      const key = OptionUtils.generateOptionKey('🔴 Red Circle', 0, 'Q-001');
      expect(key).toMatch(/^opt_red_circle_[a-f0-9]{6}$/);
    });

    test('should handle empty label', () => {
      const key = OptionUtils.generateOptionKey('', 0, 'Q-001');
      // Empty label results in just opt_ and hash
      expect(key).toMatch(/^opt__[a-f0-9]{6}$/);
    });

    test('should produce URL-safe keys', () => {
      const key = OptionUtils.generateOptionKey('Test & Special/Characters!', 0, 'Q-001');
      expect(key).toMatch(/^[a-z0-9_]+$/);
    });

    test('should produce database-safe keys', () => {
      const key = OptionUtils.generateOptionKey("SQL'; DROP TABLE--;", 0, 'Q-001');
      expect(key).not.toContain("'");
      expect(key).not.toContain(';');
      expect(key).not.toContain(' ');
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

  describe('Edge Cases and Performance', () => {
    test('should handle 1000+ options in processOptions', () => {
      const largeOptions = Array.from({ length: 1000 }, (_, i) => `Option ${i + 1}`);
      const result = OptionUtils.processOptions(largeOptions, 'Q-001');

      expect(result).toHaveLength(1000);
      expect(result[0].label).toBe('Option 1');
      expect(result[999].label).toBe('Option 1000');

      // Verify all keys are unique
      const keys = result.map(opt => opt.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(1000);
    });

    test('should handle options with very long labels (5000 characters)', () => {
      const longLabel = 'A'.repeat(5000);
      const options = [longLabel, 'Short'];
      const result = OptionUtils.processOptions(options, 'Q-001');

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe(longLabel);
      expect(result[0].label.length).toBe(5000);
      // Key should still be manageable length
      expect(result[0].key.length).toBeLessThan(50);
    });

    test('should handle case sensitivity correctly in findOption', () => {
      const options = [
        { key: 'color_red', label: 'Red' },
        { key: 'color_RED', label: 'RED' },
      ];

      const result1 = OptionUtils.findOption(options, 'Red');
      const result2 = OptionUtils.findOption(options, 'RED');
      const result3 = OptionUtils.findOption(options, 'red');

      expect(result1).toEqual(options[0]);
      expect(result2).toEqual(options[1]);
      expect(result3).toBeNull(); // lowercase not found
    });

    test('should handle special unicode characters in all functions', () => {
      const unicodeOptions = ['日本語', '한국어', '中文', 'العربية', '🔴🔵🟢'];
      const result = OptionUtils.processOptions(unicodeOptions, 'Q-001');

      expect(result).toHaveLength(5);
      expect(result[0].label).toBe('日本語');

      // Keys should still be valid
      result.forEach(opt => {
        expect(opt.key).toMatch(/^opt_[a-z0-9_]{1,37}$/);
      });
    });

    test('should handle convertToKeys with large arrays', () => {
      const options = Array.from({ length: 100 }, (_, i) => ({
        key: `opt_${i}`,
        label: `Label ${i}`,
      }));

      const labels = Array.from({ length: 50 }, (_, i) => `Label ${i}`);
      const result = OptionUtils.convertToKeys(labels, options);

      expect(result).toHaveLength(50);
      expect(result[0]).toBe('opt_0');
      expect(result[49]).toBe('opt_49');
    });

    test('should handle mixed case in convertToKeys (case sensitive)', () => {
      const options = [
        { key: 'color_red', label: 'Red' },
        { key: 'color_RED', label: 'RED' },
      ];

      expect(OptionUtils.convertToKeys('Red', options)).toBe('color_red');
      expect(OptionUtils.convertToKeys('RED', options)).toBe('color_RED');
      expect(OptionUtils.convertToKeys('red', options)).toBe('red'); // not found, returns original
    });

    test('should handle options with identical labels but different keys', () => {
      const options = [
        { key: 'opt_1', label: 'Same Label' },
        { key: 'opt_2', label: 'Same Label' },
      ];

      const result = OptionUtils.processOptions(options, 'Q-001');
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('opt_1');
      expect(result[1].key).toBe('opt_2');

      // findOption should return first match
      const found = OptionUtils.findOption(result, 'Same Label');
      expect(found.key).toBe('opt_1');
    });

    test('should handle options with null/undefined metadata gracefully', () => {
      const options = [
        { key: 'opt_1', label: 'Option 1', metadata: null },
        { key: 'opt_2', label: 'Option 2', metadata: undefined },
      ];

      const result = OptionUtils.processOptions(options, 'Q-001');
      expect(result[0].metadata).toEqual({});
      expect(result[1].metadata).toEqual({});
    });

    test('should handle processOptions with all empty string labels', () => {
      const options = ['', '', ''];
      const result = OptionUtils.processOptions(options, 'Q-001');

      expect(result).toHaveLength(3);
      // Each should have unique key despite same (empty) label
      const keys = result.map(opt => opt.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(3);
    });

    test('should handle sanitizeOptionKey with exactly 100 characters', () => {
      const exactly100 = 'a'.repeat(100);
      const result = OptionUtils.sanitizeOptionKey(exactly100);
      expect(result).toBe(exactly100);
    });

    test('should handle sanitizeOptionKey with hyphens and underscores', () => {
      expect(OptionUtils.sanitizeOptionKey('opt-key_123')).toBe('opt-key_123');
      expect(OptionUtils.sanitizeOptionKey('opt_key-123')).toBe('opt_key-123');
      expect(OptionUtils.sanitizeOptionKey('OPT_KEY_123')).toBe('OPT_KEY_123');
    });

    test('should reject sanitizeOptionKey with spaces', () => {
      expect(() => {
        OptionUtils.sanitizeOptionKey('opt key 123');
      }).toThrow(ValidationError);
      expect(() => {
        OptionUtils.sanitizeOptionKey('opt key 123');
      }).toThrow('alphanumeric characters, underscores, and hyphens');
    });

    test('should handle isValidAnswer with empty options array', () => {
      const result = OptionUtils.isValidAnswer('Red', [], 'select');
      expect(result).toBe(false);
    });

    test('should handle requiresOptions with undefined/null type', () => {
      expect(OptionUtils.requiresOptions(undefined)).toBe(false);
      expect(OptionUtils.requiresOptions(null)).toBe(false);
      expect(OptionUtils.requiresOptions('')).toBe(false);
    });
  });
});
