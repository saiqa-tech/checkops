import {
  sanitizeString,
  sanitizeHtml,
  sanitizeEmail,
  sanitizeObject,
  sanitizeJsonb,
} from '../../../src/utils/sanitization.js';

describe('Sanitization Utils', () => {
  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    it('should convert non-strings', () => {
      expect(sanitizeString(123)).toBe('123');
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;&#x2F;div&gt;');
      expect(sanitizeHtml('5 > 3 & 2 < 4')).toBe('5 &gt; 3 &amp; 2 &lt; 4');
    });

    it('should handle quotes', () => {
      expect(sanitizeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(sanitizeHtml("'single'")).toBe('&#x27;single&#x27;');
    });
  });

  describe('sanitizeEmail', () => {
    it('should lowercase and trim email', () => {
      expect(sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
    });

    it('should handle invalid input', () => {
      expect(sanitizeEmail(null)).toBe('');
      expect(sanitizeEmail(123)).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize object values', () => {
      const input = {
        name: '<script>xss</script>',
        age: 25,
        nested: {
          value: 'test<>',
        },
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('scriptxss/script');
      expect(result.age).toBe(25);
      expect(result.nested.value).toBe('test');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>', 'normal', 'test<>'];
      const result = sanitizeObject(input);

      expect(result).toEqual(['script', 'normal', 'test']);
    });

    it('should handle null', () => {
      expect(sanitizeObject(null)).toBe(null);
    });
  });

  describe('sanitizeJsonb', () => {
    it('should parse and sanitize JSON string', () => {
      const input = '{"name": "<script>xss</script>"}';
      const result = sanitizeJsonb(input);

      expect(result.name).toBe('scriptxss/script');
    });

    it('should sanitize object', () => {
      const input = { name: '<script>xss</script>' };
      const result = sanitizeJsonb(input);

      expect(result.name).toBe('scriptxss/script');
    });

    it('should throw for invalid JSON', () => {
      expect(() => sanitizeJsonb('invalid json')).toThrow();
    });
  });
});
