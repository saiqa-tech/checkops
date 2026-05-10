/**
 * Unit tests: field mapping for requireAll (Form) and targeting fields (Submission).
 *
 * These are pure constructor / fromRow tests — no database connection required.
 * Validated by: npm run test:unit
 */

import { Form } from '../../../src/models/Form.js';
import { Submission } from '../../../src/models/Submission.js';

// ── Form.requireAll field ──────────────────────────────────────────────────────

describe('Form — requireAll field mapping', () => {
    it('defaults requireAll to true when neither require_all nor requireAll is provided', () => {
        const form = new Form({ id: 'uuid-1', title: 'T' });
        expect(form.requireAll).toBe(true);
    });

    it('reads requireAll from snake_case require_all (DB row shape)', () => {
        const form = new Form({ id: 'uuid-1', title: 'T', require_all: false });
        expect(form.requireAll).toBe(false);
    });

    it('reads requireAll from camelCase requireAll (constructor shape)', () => {
        const form = new Form({ id: 'uuid-1', title: 'T', requireAll: false });
        expect(form.requireAll).toBe(false);
    });

    it('prefers require_all over requireAll when both are present', () => {
        const form = new Form({ id: 'uuid-1', title: 'T', require_all: true, requireAll: false });
        expect(form.requireAll).toBe(true);
    });

    it('toJSON() preserves requireAll', () => {
        const form = new Form({ id: 'uuid-1', sid: 'FORM-001', title: 'T', requireAll: false });
        expect(form.toJSON().requireAll).toBe(false);
    });
});

describe('Form.fromRow() — requireAll mapping', () => {
    it('maps row.require_all = false to form.requireAll = false', () => {
        const row = {
            id: 'uuid-1',
            sid: 'FORM-001',
            title: 'T',
            description: '',
            questions: [],
            metadata: {},
            require_all: false,
            is_active: true,
            created_at: null,
            updated_at: null,
        };
        const form = Form.fromRow(row);
        expect(form.requireAll).toBe(false);
    });

    it('maps row.require_all = true to form.requireAll = true', () => {
        const row = {
            id: 'uuid-2',
            sid: 'FORM-002',
            title: 'T',
            require_all: true,
            is_active: true,
        };
        const form = Form.fromRow(row);
        expect(form.requireAll).toBe(true);
    });

    it('returns null for a null row', () => {
        expect(Form.fromRow(null)).toBeNull();
    });
});

// ── Submission targeting fields ────────────────────────────────────────────────

describe('Submission — targetUnitId and submitterUserId field mapping', () => {
    it('defaults both targeting fields to null when not provided', () => {
        const sub = new Submission({ id: 'uuid-1', formId: 'f-uuid-1' });
        expect(sub.targetUnitId).toBeNull();
        expect(sub.submitterUserId).toBeNull();
    });

    it('reads targetUnitId from camelCase (constructor shape)', () => {
        const sub = new Submission({ id: 'uuid-1', targetUnitId: 'unit-uuid-1' });
        expect(sub.targetUnitId).toBe('unit-uuid-1');
    });

    it('reads targetUnitId from snake_case target_unit_id (DB row shape)', () => {
        const sub = new Submission({ id: 'uuid-1', target_unit_id: 'unit-uuid-2' });
        expect(sub.targetUnitId).toBe('unit-uuid-2');
    });

    it('reads submitterUserId from camelCase (constructor shape)', () => {
        const sub = new Submission({ id: 'uuid-1', submitterUserId: 'user-uuid-1' });
        expect(sub.submitterUserId).toBe('user-uuid-1');
    });

    it('reads submitterUserId from snake_case submitter_user_id (DB row shape)', () => {
        const sub = new Submission({ id: 'uuid-1', submitter_user_id: 'user-uuid-2' });
        expect(sub.submitterUserId).toBe('user-uuid-2');
    });

    it('prefers camelCase targetUnitId over snake_case when both are present', () => {
        const sub = new Submission({
            id: 'uuid-1',
            targetUnitId: 'camel-unit',
            target_unit_id: 'snake-unit',
        });
        expect(sub.targetUnitId).toBe('camel-unit');
    });

    it('toJSON() preserves both targeting fields', () => {
        const sub = new Submission({
            id: 'uuid-1',
            sid: 'SUB-001',
            targetUnitId: 'unit-uuid-1',
            submitterUserId: 'user-uuid-1',
        });
        const json = sub.toJSON();
        expect(json.targetUnitId).toBe('unit-uuid-1');
        expect(json.submitterUserId).toBe('user-uuid-1');
    });
});

describe('Submission.fromRow() — targeting field mapping', () => {
    it('maps row.target_unit_id to targetUnitId', () => {
        const row = {
            id: 'uuid-1',
            sid: 'SUB-001',
            form_id: 'form-uuid-1',
            form_sid: 'FORM-001',
            submission_data: {},
            metadata: {},
            submitted_at: null,
            target_unit_id: 'unit-uuid-99',
            submitter_user_id: null,
        };
        const sub = Submission.fromRow(row);
        expect(sub.targetUnitId).toBe('unit-uuid-99');
    });

    it('maps row.submitter_user_id to submitterUserId', () => {
        const row = {
            id: 'uuid-1',
            sid: 'SUB-001',
            form_id: 'form-uuid-1',
            form_sid: 'FORM-001',
            submission_data: {},
            metadata: {},
            submitted_at: null,
            target_unit_id: null,
            submitter_user_id: 'user-uuid-77',
        };
        const sub = Submission.fromRow(row);
        expect(sub.submitterUserId).toBe('user-uuid-77');
    });

    it('maps null columns to null fields', () => {
        const row = {
            id: 'uuid-1',
            sid: 'SUB-001',
            form_id: 'form-uuid-1',
            form_sid: 'FORM-001',
            submission_data: {},
            metadata: {},
            submitted_at: null,
            target_unit_id: null,
            submitter_user_id: null,
        };
        const sub = Submission.fromRow(row);
        expect(sub.targetUnitId).toBeNull();
        expect(sub.submitterUserId).toBeNull();
    });

    it('returns null for a null row', () => {
        expect(Submission.fromRow(null)).toBeNull();
    });
});
