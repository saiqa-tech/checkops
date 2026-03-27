/**
 * Tests for idResolver utility
 * v4.0.0 Dual-ID System
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
    isUUID,
    isSID,
    resolveToUUID,
    resolveToSID,
    resolveMultipleToUUID,
    isValidID,
    getIDType,
    generateSID,
    getNextSIDCounter,
    batchResolveToUUID
} from '../../src/utils/idResolver.js';
import { getPool } from '../../src/config/database.js';

describe('idResolver - Format Validation', () => {
    describe('isUUID()', () => {
        it('should return true for valid UUID v4', () => {
            expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        });

        it('should return true for valid UUID (case insensitive)', () => {
            expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
            expect(isUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
        });

        it('should return false for invalid UUID', () => {
            expect(isUUID('not-a-uuid')).toBe(false);
            expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
            expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No dashes
            expect(isUUID('')).toBe(false);
            expect(isUUID(null)).toBe(false);
            expect(isUUID(undefined)).toBe(false);
        });

        it('should return false for SID format', () => {
            expect(isUUID('FORM-001')).toBe(false);
            expect(isUUID('Q-001')).toBe(false);
            expect(isUUID('SUB-001')).toBe(false);
        });
    });

    describe('isSID()', () => {
        it('should return true for valid SID without prefix check', () => {
            expect(isSID('FORM-001')).toBe(true);
            expect(isSID('Q-001')).toBe(true);
            expect(isSID('SUB-001')).toBe(true);
            expect(isSID('CUSTOM-999')).toBe(true);
        });

        it('should return true for valid SID with prefix check', () => {
            expect(isSID('FORM-001', 'FORM')).toBe(true);
            expect(isSID('Q-001', 'Q')).toBe(true);
            expect(isSID('SUB-001', 'SUB')).toBe(true);
        });

        it('should return false for SID with wrong prefix', () => {
            expect(isSID('FORM-001', 'Q')).toBe(false);
            expect(isSID('Q-001', 'FORM')).toBe(false);
            expect(isSID('SUB-001', 'FORM')).toBe(false);
        });

        it('should return false for invalid SID format', () => {
            expect(isSID('form-001')).toBe(false); // lowercase
            expect(isSID('FORM001')).toBe(false); // no dash
            expect(isSID('FORM-')).toBe(false); // no number
            expect(isSID('FORM-ABC')).toBe(false); // not a number
            expect(isSID('')).toBe(false);
            expect(isSID(null)).toBe(false);
            expect(isSID(undefined)).toBe(false);
        });

        it('should return false for UUID format', () => {
            expect(isSID('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
        });
    });

    describe('isValidID()', () => {
        it('should return true for valid UUID', () => {
            expect(isValidID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should return true for valid SID', () => {
            expect(isValidID('FORM-001')).toBe(true);
            expect(isValidID('Q-001')).toBe(true);
        });

        it('should return true for valid SID with prefix check', () => {
            expect(isValidID('FORM-001', 'FORM')).toBe(true);
            expect(isValidID('Q-001', 'Q')).toBe(true);
        });

        it('should return false for invalid ID', () => {
            expect(isValidID('invalid-id')).toBe(false);
            expect(isValidID('')).toBe(false);
            expect(isValidID(null)).toBe(false);
        });
    });

    describe('getIDType()', () => {
        it('should return "uuid" for UUID', () => {
            expect(getIDType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
        });

        it('should return "sid" for SID', () => {
            expect(getIDType('FORM-001')).toBe('sid');
            expect(getIDType('Q-001')).toBe('sid');
            expect(getIDType('SUB-001')).toBe('sid');
        });

        it('should return "invalid" for invalid ID', () => {
            expect(getIDType('invalid-id')).toBe('invalid');
            expect(getIDType('')).toBe('invalid');
            expect(getIDType(null)).toBe('invalid');
        });
    });
});

describe('idResolver - SID Generation', () => {
    describe('generateSID()', () => {
        it('should generate valid form SID', () => {
            expect(generateSID('form', 1)).toBe('FORM-001');
            expect(generateSID('form', 10)).toBe('FORM-010');
            expect(generateSID('form', 100)).toBe('FORM-100');
            expect(generateSID('form', 1000)).toBe('FORM-1000');
        });

        it('should generate valid question SID', () => {
            expect(generateSID('question', 1)).toBe('Q-001');
            expect(generateSID('question', 10)).toBe('Q-010');
            expect(generateSID('question', 100)).toBe('Q-100');
        });

        it('should generate valid submission SID', () => {
            expect(generateSID('submission', 1)).toBe('SUB-001');
            expect(generateSID('submission', 10)).toBe('SUB-010');
            expect(generateSID('submission', 100)).toBe('SUB-100');
        });

        it('should pad numbers with zeros', () => {
            expect(generateSID('form', 1)).toBe('FORM-001');
            expect(generateSID('form', 5)).toBe('FORM-005');
            expect(generateSID('form', 99)).toBe('FORM-099');
        });

        it('should throw error for invalid entity type', () => {
            expect(() => generateSID('invalid', 1)).toThrow('Invalid entity type');
        });
    });
});

describe.skip('idResolver - Database Operations (requires v4.0.0 schema)', () => {
    let pool;
    let testFormUuid;
    let testFormSid;
    let testQuestionUuid;
    let testQuestionSid;

    beforeAll(async () => {
        pool = getPool();

        // Create test form
        const formResult = await pool.query(`
      INSERT INTO forms (sid, title, description, questions, metadata)
      VALUES ('FORM-TEST-001', 'Test Form', 'Test Description', '[]', '{}')
      RETURNING id, sid
    `);
        testFormUuid = formResult.rows[0].id;
        testFormSid = formResult.rows[0].sid;

        // Create test question
        const questionResult = await pool.query(`
      INSERT INTO question_bank (sid, question_text, question_type)
      VALUES ('Q-TEST-001', 'Test Question', 'text')
      RETURNING id, sid
    `);
        testQuestionUuid = questionResult.rows[0].id;
        testQuestionSid = questionResult.rows[0].sid;
    });

    afterAll(async () => {
        // Cleanup test data
        await pool.query('DELETE FROM forms WHERE sid = $1', [testFormSid]);
        await pool.query('DELETE FROM question_bank WHERE sid = $1', [testQuestionSid]);
    });

    describe('resolveToUUID()', () => {
        it('should return UUID when given UUID', async () => {
            const result = await resolveToUUID(testFormUuid, 'forms');
            expect(result).toBe(testFormUuid);
        });

        it('should resolve SID to UUID', async () => {
            const result = await resolveToUUID(testFormSid, 'forms');
            expect(result).toBe(testFormUuid);
        });

        it('should return null for non-existent SID', async () => {
            const result = await resolveToUUID('FORM-NONEXISTENT', 'forms');
            expect(result).toBeNull();
        });

        it('should return null for invalid ID format', async () => {
            const result = await resolveToUUID('invalid-id', 'forms');
            expect(result).toBeNull();
        });

        it('should return null for null input', async () => {
            const result = await resolveToUUID(null, 'forms');
            expect(result).toBeNull();
        });

        it('should work with question_bank table', async () => {
            const result = await resolveToUUID(testQuestionSid, 'question_bank');
            expect(result).toBe(testQuestionUuid);
        });
    });

    describe('resolveToSID()', () => {
        it('should return SID when given SID', async () => {
            const result = await resolveToSID(testFormSid, 'forms');
            expect(result).toBe(testFormSid);
        });

        it('should resolve UUID to SID', async () => {
            const result = await resolveToSID(testFormUuid, 'forms');
            expect(result).toBe(testFormSid);
        });

        it('should return null for non-existent UUID', async () => {
            const result = await resolveToSID('550e8400-e29b-41d4-a716-446655440000', 'forms');
            expect(result).toBeNull();
        });

        it('should return null for invalid ID format', async () => {
            const result = await resolveToSID('invalid-id', 'forms');
            expect(result).toBeNull();
        });

        it('should return null for null input', async () => {
            const result = await resolveToSID(null, 'forms');
            expect(result).toBeNull();
        });

        it('should work with question_bank table', async () => {
            const result = await resolveToSID(testQuestionUuid, 'question_bank');
            expect(result).toBe(testQuestionSid);
        });
    });

    describe('resolveMultipleToUUID()', () => {
        it('should resolve multiple SIDs to UUIDs', async () => {
            const result = await resolveMultipleToUUID(
                [testFormSid, testFormUuid],
                'forms'
            );
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(testFormUuid);
            expect(result[1]).toBe(testFormUuid);
        });

        it('should return null for non-existent IDs', async () => {
            const result = await resolveMultipleToUUID(
                [testFormSid, 'FORM-NONEXISTENT'],
                'forms'
            );
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(testFormUuid);
            expect(result[1]).toBeNull();
        });

        it('should return empty array for empty input', async () => {
            const result = await resolveMultipleToUUID([], 'forms');
            expect(result).toEqual([]);
        });

        it('should return empty array for null input', async () => {
            const result = await resolveMultipleToUUID(null, 'forms');
            expect(result).toEqual([]);
        });
    });

    describe('batchResolveToUUID()', () => {
        it('should batch resolve SIDs to UUIDs', async () => {
            const result = await batchResolveToUUID(
                [testFormSid, testFormUuid],
                'forms'
            );
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2);
            expect(result.get(testFormSid)).toBe(testFormUuid);
            expect(result.get(testFormUuid)).toBe(testFormUuid);
        });

        it('should handle mixed UUIDs and SIDs', async () => {
            const result = await batchResolveToUUID(
                [testFormSid, testFormUuid],
                'forms'
            );
            expect(result.get(testFormSid)).toBe(testFormUuid);
            expect(result.get(testFormUuid)).toBe(testFormUuid);
        });

        it('should not include non-existent IDs in result', async () => {
            const result = await batchResolveToUUID(
                [testFormSid, 'FORM-NONEXISTENT'],
                'forms'
            );
            expect(result.size).toBe(1);
            expect(result.has(testFormSid)).toBe(true);
            expect(result.has('FORM-NONEXISTENT')).toBe(false);
        });

        it('should return empty map for empty input', async () => {
            const result = await batchResolveToUUID([], 'forms');
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });
    });

    describe('getNextSIDCounter()', () => {
        it('should return next counter for forms', async () => {
            const counter = await getNextSIDCounter('form');
            expect(typeof counter).toBe('number');
            expect(counter).toBeGreaterThan(0);
        });

        it('should return next counter for questions', async () => {
            const counter = await getNextSIDCounter('question');
            expect(typeof counter).toBe('number');
            expect(counter).toBeGreaterThan(0);
        });

        it('should return next counter for submissions', async () => {
            const counter = await getNextSIDCounter('submission');
            expect(typeof counter).toBe('number');
            expect(counter).toBeGreaterThanOrEqual(0);
        });

        it('should throw error for invalid entity type', async () => {
            await expect(getNextSIDCounter('invalid')).rejects.toThrow();
        });
    });
});

describe('idResolver - Edge Cases', () => {
    it('should handle empty strings', () => {
        expect(isUUID('')).toBe(false);
        expect(isSID('')).toBe(false);
        expect(isValidID('')).toBe(false);
        expect(getIDType('')).toBe('invalid');
    });

    it('should handle null values', () => {
        expect(isUUID(null)).toBe(false);
        expect(isSID(null)).toBe(false);
        expect(isValidID(null)).toBe(false);
        expect(getIDType(null)).toBe('invalid');
    });

    it('should handle undefined values', () => {
        expect(isUUID(undefined)).toBe(false);
        expect(isSID(undefined)).toBe(false);
        expect(isValidID(undefined)).toBe(false);
        expect(getIDType(undefined)).toBe('invalid');
    });

    it('should handle non-string values', () => {
        expect(isUUID(123)).toBe(false);
        expect(isSID(123)).toBe(false);
        expect(isValidID(123)).toBe(false);
        expect(getIDType(123)).toBe('invalid');
    });

    it('should handle objects', () => {
        expect(isUUID({})).toBe(false);
        expect(isSID({})).toBe(false);
        expect(isValidID({})).toBe(false);
        expect(getIDType({})).toBe('invalid');
    });

    it('should handle arrays', () => {
        expect(isUUID([])).toBe(false);
        expect(isSID([])).toBe(false);
        expect(isValidID([])).toBe(false);
        expect(getIDType([])).toBe('invalid');
    });
});
