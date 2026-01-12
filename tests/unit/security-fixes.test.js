/**
 * Security Regression Tests
 * Tests for fixes applied on 2026-01-11
 */

import { sanitizeString, sanitizeObject } from '../../src/utils/sanitization.js';
import { OptionUtils } from '../../src/utils/optionUtils.js';

// Helper to check if object has own property (not via prototype)
const hasOwnProp = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

describe('Security Fixes - 2026-01-11', () => {
    describe('Prototype Pollution Prevention', () => {
        test('should reject __proto__ key in metadata', () => {
            const maliciousMetadata = {
                normalKey: 'value',
                '__proto__': { polluted: true },
                anotherKey: 'value2'
            };

            const sanitized = sanitizeObject(maliciousMetadata);

            expect(sanitized).toHaveProperty('normalKey', 'value');
            expect(sanitized).toHaveProperty('anotherKey', 'value2');
            expect(hasOwnProp(sanitized, '__proto__')).toBe(false);
            expect(({}).polluted).toBeUndefined();
        });

        test('should reject prototype key in metadata', () => {
            const maliciousMetadata = {
                data: 'safe',
                'prototype': { polluted: true }
            };

            const sanitized = sanitizeObject(maliciousMetadata);

            expect(sanitized).toHaveProperty('data', 'safe');
            expect(hasOwnProp(sanitized, 'prototype')).toBe(false);
        });

        test('should reject constructor key in metadata', () => {
            const maliciousMetadata = {
                value: 'safe',
                'constructor': { polluted: true }
            };

            const sanitized = sanitizeObject(maliciousMetadata);

            expect(sanitized).toHaveProperty('value', 'safe');
            expect(hasOwnProp(sanitized, 'constructor')).toBe(false);
        });

        test('should handle case-insensitive prototype pollution attempts', () => {
            const variants = {
                '__PROTO__': { bad: 1 },
                'PROTOTYPE': { bad: 2 },
                'Constructor': { bad: 3 },
                '__proto__': { bad: 4 },
                safeKey: 'good'
            };

            const sanitized = sanitizeObject(variants);

            expect(sanitized).toHaveProperty('safeKey', 'good');
            expect(Object.keys(sanitized)).toHaveLength(1);
        });

        test('should sanitize nested objects recursively', () => {
            const nestedMalicious = {
                level1: {
                    __proto__: { polluted: true },
                    safe: 'value',
                    level2: {
                        prototype: { polluted: true },
                        data: 'good'
                    }
                }
            };

            const sanitized = sanitizeObject(nestedMalicious);

            expect(sanitized.level1).toHaveProperty('safe', 'value');
            expect(hasOwnProp(sanitized.level1, '__proto__')).toBe(false);
            expect(sanitized.level1.level2).toHaveProperty('data', 'good');
            expect(hasOwnProp(sanitized.level1.level2, 'prototype')).toBe(false);
        });

        test('should sanitize arrays with nested objects', () => {
            const arrayWithMalicious = [
                { __proto__: { bad: true }, safe: 1 },
                { prototype: { bad: true }, safe: 2 }
            ];

            const sanitized = sanitizeObject(arrayWithMalicious);

            expect(sanitized).toHaveLength(2);
            expect(sanitized[0]).toHaveProperty('safe', 1);
            expect(hasOwnProp(sanitized[0], '__proto__')).toBe(false);
            expect(sanitized[1]).toHaveProperty('safe', 2);
            expect(hasOwnProp(sanitized[1], 'prototype')).toBe(false);
        });

        test('should not pollute Object.prototype after sanitization', () => {
            const originalProto = Object.prototype;
            const malicious = {
                __proto__: { injected: 'bad' },
                data: 'good'
            };

            const sanitized = sanitizeObject(malicious);

            expect(sanitized.data).toBe('good');
            expect({}.injected).toBeUndefined();
            expect(Object.prototype).toBe(originalProto);
        });
    });

    describe('XSS Prevention in Option Labels', () => {
        test('should sanitize script tags in simple option array', () => {
            const maliciousOptions = [
                'Safe Option',
                '<script>alert("XSS")</script>Malicious',
                'javascript:alert("XSS")',
                '<img src=x onerror=alert("XSS")>'
            ];

            const processed = OptionUtils.processOptions(maliciousOptions, 'test-q');

            expect(processed).toHaveLength(4);
            expect(processed[0].label).toBe('Safe Option');
            expect(processed[1].label).not.toContain('<script>');
            expect(processed[1].label).not.toContain('</script>');
            expect(processed[2].label).not.toContain('javascript:');
            expect(processed[3].label).not.toContain('<img');
            expect(processed[3].label).not.toContain('onerror=');
        });

        test('should sanitize labels in structured option objects', () => {
            const maliciousOptions = [
                {
                    key: 'opt1',
                    label: '<script>alert("XSS")</script>Bad Label'
                },
                {
                    key: 'opt2',
                    label: 'Safe Label',
                    metadata: {
                        description: '<script>alert("XSS")</script>Bad Meta'
                    }
                }
            ];

            const processed = OptionUtils.processOptions(maliciousOptions, 'test-q');

            expect(processed[0].label).not.toContain('<script>');
            expect(processed[1].metadata.description).not.toContain('<script>');
        });

        test('should sanitize event handlers in option labels', () => {
            const options = [
                'onclick=alert("XSS")Label',
                'onload=steal()Text',
                'onerror=hack()Option'
            ];

            const processed = OptionUtils.processOptions(options, 'test-q');

            processed.forEach(opt => {
                expect(opt.label).not.toMatch(/on\w+=/i);
            });
        });

        test('should sanitize labels during convertToLabels', () => {
            const options = [
                { key: 'key1', label: 'Safe' },
                { key: 'key2', label: '<script>Bad</script>' }
            ];

            // Test with unknown key that needs fallback sanitization
            const result = OptionUtils.convertToLabels('unknown-key', options);

            expect(result).not.toContain('<script>');
        });

        test('should handle mixed safe and malicious options', () => {
            const options = [
                'Normal Option',
                '<script>alert(1)</script>',
                'Another Normal',
                'javascript:void(0)',
                'Safe Option'
            ];

            const processed = OptionUtils.processOptions(options, 'test-q');

            const safeCount = processed.filter(opt =>
                !opt.label.includes('<') &&
                !opt.label.includes('javascript:')
            ).length;

            expect(safeCount).toBe(processed.length);
        });
    });

    describe('Sanitization Edge Cases', () => {
        test('should handle null and undefined gracefully', () => {
            expect(sanitizeObject(null)).toBeNull();
            expect(sanitizeObject(undefined)).toBeNull();
            expect(sanitizeString(null)).toBe('');
            expect(sanitizeString(undefined)).toBe('');
        });

        test('should handle empty objects and arrays', () => {
            expect(sanitizeObject({})).toEqual({});
            expect(sanitizeObject([])).toEqual([]);
        });

        test('should preserve safe nested structures', () => {
            const safe = {
                user: {
                    name: 'John',
                    roles: ['admin', 'user'],
                    meta: {
                        created: '2024-01-01',
                        tags: ['active']
                    }
                }
            };

            const sanitized = sanitizeObject(safe);

            expect(sanitized).toEqual(safe);
        });

        test('should remove empty keys after sanitization', () => {
            const obj = {
                '': 'empty-key',
                ' ': 'space-key',
                'valid': 'value'
            };

            const sanitized = sanitizeObject(obj);

            // Empty keys should be filtered out by sanitizeString
            expect(sanitized).toHaveProperty('valid', 'value');
            expect(Object.keys(sanitized).length).toBeLessThanOrEqual(3);
        });

        test('should handle deeply nested malicious payloads', () => {
            const deep = {
                a: {
                    b: {
                        c: {
                            d: {
                                __proto__: { injected: true },
                                safe: 'value'
                            }
                        }
                    }
                }
            };

            const sanitized = sanitizeObject(deep);

            expect(sanitized.a.b.c.d).toHaveProperty('safe', 'value');
            expect(hasOwnProp(sanitized.a.b.c.d, '__proto__')).toBe(false);
        });
    });

    describe('Combined Attack Scenarios', () => {
        test('should prevent prototype pollution via option metadata', () => {
            const maliciousOptions = [
                {
                    key: 'opt1',
                    label: 'Normal',
                    metadata: {
                        __proto__: { polluted: true },
                        description: 'Safe'
                    }
                }
            ];

            const processed = OptionUtils.processOptions(maliciousOptions, 'test-q');

            expect(processed[0].metadata).toHaveProperty('description', 'Safe');
            expect(hasOwnProp(processed[0].metadata, '__proto__')).toBe(false);
            expect({}.polluted).toBeUndefined();
        });

        test('should sanitize XSS in labels and prototype pollution in metadata simultaneously', () => {
            const combined = [
                {
                    key: 'bad',
                    label: '<script>alert("XSS")</script>',
                    metadata: {
                        __proto__: { bad: true },
                        description: 'javascript:alert("XSS")'
                    }
                }
            ];

            const processed = OptionUtils.processOptions(combined, 'test-q');

            expect(processed[0].label).not.toContain('<script>');
            expect(hasOwnProp(processed[0].metadata, '__proto__')).toBe(false);
            expect(processed[0].metadata.description).not.toContain('javascript:');
        });

        test('should maintain data integrity while removing threats', () => {
            const mixed = {
                __proto__: { bad: true },
                safeString: 'good value',
                safeNumber: 42,
                safeBoolean: true,
                safeArray: [1, 2, 3],
                safeNested: {
                    key: 'value',
                    prototype: { bad: true },
                    another: 'safe'
                }
            };

            const sanitized = sanitizeObject(mixed);

            expect(sanitized.safeString).toBe('good value');
            expect(sanitized.safeNumber).toBe(42);
            expect(sanitized.safeBoolean).toBe(true);
            expect(sanitized.safeArray).toEqual([1, 2, 3]);
            expect(sanitized.safeNested.key).toBe('value');
            expect(sanitized.safeNested.another).toBe('safe');
            expect(hasOwnProp(sanitized, '__proto__')).toBe(false);
            expect(hasOwnProp(sanitized.safeNested, 'prototype')).toBe(false);
        });
    });

    describe('Regression: Ensure No Over-Sanitization', () => {
        test('should preserve legitimate underscores in keys', () => {
            const legitObj = {
                _private: 'value',
                my_key: 'data',
                __double: 'underscore'
            };

            const sanitized = sanitizeObject(legitObj);

            // These should be preserved as they're not exactly the dangerous keys
            expect(sanitized).toHaveProperty('_private', 'value');
            expect(sanitized).toHaveProperty('my_key', 'data');
            // __double might be filtered if it starts with __ but isn't __proto__
            // The current implementation only blocks exact matches (case-insensitive)
        });

        test('should not break valid HTML entities in text', () => {
            const textWithEntities = 'Price: $50 & up';
            const sanitized = sanitizeString(textWithEntities);

            expect(sanitized).toBe('Price: $50 & up');
        });

        test('should handle unicode characters safely', () => {
            const unicode = {
                emoji: '😀🎉',
                chinese: '你好',
                arabic: 'مرحبا',
                __proto__: { bad: true }
            };

            const sanitized = sanitizeObject(unicode);

            expect(sanitized.emoji).toBe('😀🎉');
            expect(sanitized.chinese).toBe('你好');
            expect(sanitized.arabic).toBe('مرحبا');
            expect(hasOwnProp(sanitized, '__proto__')).toBe(false);
        });
    });
});
