/**
 * Finding Model - v4.0.0
 * 
 * This model uses the dual-ID system:
 * - id (UUID): Internal primary key for all database operations
 * - sid (VARCHAR): Human-readable ID (FND-001) for display only
 */

import { getPool } from '../config/database.js';
import { generateSID, getNextSIDCounter } from '../utils/idResolver.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

export class Finding {
    constructor(data) {
        this.id = data.id;                                    // UUID (primary key)
        this.sid = data.sid;                                  // Human-readable (FND-001)
        this.submissionId = data.submissionId ?? data.submission_id;
        this.submissionSid = data.submissionSid ?? data.submission_sid;
        this.questionId = data.questionId ?? data.question_id;
        this.questionSid = data.questionSid ?? data.question_sid;
        this.formId = data.formId ?? data.form_id;
        this.formSid = data.formSid ?? data.form_sid;
        this.severity = data.severity;
        this.department = data.department;
        this.observation = data.observation;
        this.rootCause = data.rootCause ?? data.root_cause;
        this.evidenceUrls = data.evidenceUrls ?? data.evidence_urls;
        this.assignment = data.assignment;
        this.status = data.status;
        this.metadata = data.metadata;
        this.createdAt = data.createdAt ?? data.created_at;
        this.createdBy = data.createdBy ?? data.created_by;
    }

    toJSON() {
        return {
            id: this.id,
            sid: this.sid,
            submissionId: this.submissionId,
            submissionSid: this.submissionSid,
            questionId: this.questionId,
            questionSid: this.questionSid,
            formId: this.formId,
            formSid: this.formSid,
            severity: this.severity,
            department: this.department,
            observation: this.observation,
            rootCause: this.rootCause,
            evidenceUrls: this.evidenceUrls,
            assignment: this.assignment,
            status: this.status,
            metadata: this.metadata,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
        };
    }

    static fromRow(row) {
        if (!row) return null;
        return new Finding({
            id: row.id,
            sid: row.sid,
            submissionId: row.submission_id,
            submissionSid: row.submission_sid,
            questionId: row.question_id,
            questionSid: row.question_sid,
            formId: row.form_id,
            formSid: row.form_sid,
            severity: row.severity,
            department: row.department,
            observation: row.observation,
            rootCause: row.root_cause,
            evidenceUrls: row.evidence_urls,
            assignment: row.assignment,
            status: row.status,
            metadata: row.metadata,
            createdAt: row.created_at,
            createdBy: row.created_by,
        });
    }

    /**
     * Create finding
     * @param {object} params
     * @param {string} params.submissionId - Submission UUID (internal operations)
     * @param {string} params.questionId - Question UUID (internal operations)
     * @param {string} params.formId - Form UUID (internal operations)
     * @param {string} params.severity - Severity level (nullable)
     * @param {string} params.department - Department (nullable)
     * @param {string} params.observation - Observation text (nullable)
     * @param {string} params.rootCause - Root cause analysis (nullable)
     * @param {string[]} params.evidenceUrls - Array of evidence URLs (nullable)
     * @param {object[]} params.assignment - Array of assignment objects (default: [])
     * @param {string} params.status - Status (nullable)
     * @param {object} params.metadata - Additional metadata (default: {})
     * @param {string} params.createdBy - Creator identifier (nullable)
     * @returns {Promise<Finding>}
     */
    static async create({
        submissionId,
        questionId,
        formId,
        severity = null,
        department = null,
        observation = null,
        rootCause = null,
        evidenceUrls = null,
        assignment = [],
        status = null,
        metadata = {},
        createdBy = null
    }) {
        const pool = getPool();

        // Look up parent SIDs in one query
        const sidResult = await pool.query(
            `SELECT s.sid AS submission_sid, q.sid AS question_sid, f.sid AS form_sid
             FROM submissions s, question_bank q, forms f
             WHERE s.id = $1 AND q.id = $2 AND f.id = $3`,
            [submissionId, questionId, formId]
        );

        if (sidResult.rows.length === 0) {
            throw new NotFoundError('Submission, Question, or Form', `${submissionId} / ${questionId} / ${formId}`);
        }

        const { submission_sid, question_sid, form_sid } = sidResult.rows[0];

        // Generate SID (human-readable ID)
        const counter = await getNextSIDCounter('finding');
        const sid = generateSID('finding', counter);

        try {
            // UUID is generated by database (DEFAULT gen_random_uuid())
            const result = await pool.query(
                `INSERT INTO public.findings (
          sid, submission_id, submission_sid, question_id, question_sid,
          form_id, form_sid, severity, department, observation, root_cause,
          evidence_urls, assignment, status, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
                [
                    sid,
                    submissionId,
                    submission_sid,
                    questionId,
                    question_sid,
                    formId,
                    form_sid,
                    severity,
                    department,
                    observation,
                    rootCause,
                    evidenceUrls,
                    JSON.stringify(assignment),
                    status,
                    JSON.stringify(metadata),
                    createdBy
                ]
            );

            return Finding.fromRow(result.rows[0]);
        } catch (error) {
            throw new DatabaseError('Failed to create finding', error);
        }
    }

    /**
     * Find finding by UUID (internal use)
     * @param {string} uuid - UUID only
     * @returns {Promise<Finding>}
     */
    static async findById(uuid) {
        const pool = getPool();

        const result = await pool.query('SELECT * FROM public.findings WHERE id = $1', [uuid]);

        if (result.rows.length === 0) {
            throw new NotFoundError('Finding', uuid);
        }

        return Finding.fromRow(result.rows[0]);
    }

    /**
     * Find findings by form UUID
     * @param {string} formId - Form UUID
     * @param {object} options - Pagination options
     * @returns {Promise<Array<Finding>>}
     */
    static async findByFormId(formId, { limit = 100, offset = 0 } = {}) {
        const pool = getPool();

        const result = await pool.query(
            'SELECT * FROM public.findings WHERE form_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [formId, limit, offset]
        );

        return result.rows.map(row => Finding.fromRow(row));
    }

    /**
     * Find findings by submission UUID
     * @param {string} submissionId - Submission UUID
     * @returns {Promise<Array<Finding>>}
     */
    static async findBySubmissionId(submissionId) {
        const pool = getPool();

        const result = await pool.query(
            'SELECT * FROM public.findings WHERE submission_id = $1 ORDER BY created_at DESC',
            [submissionId]
        );

        return result.rows.map(row => Finding.fromRow(row));
    }

    /**
     * Find findings by question UUID
     * @param {string} questionId - Question UUID
     * @param {object} options - Pagination options
     * @returns {Promise<Array<Finding>>}
     */
    static async findByQuestionId(questionId, { limit = 100, offset = 0 } = {}) {
        const pool = getPool();

        const result = await pool.query(
            'SELECT * FROM public.findings WHERE question_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [questionId, limit, offset]
        );

        return result.rows.map(row => Finding.fromRow(row));
    }

    /**
     * Find findings with filters (for reporting)
     * @param {object} filters
     * @param {string} filters.formId - Form UUID (optional)
     * @param {string} filters.severity - Severity level (optional)
     * @param {string} filters.department - Department (optional)
     * @param {string} filters.status - Status (optional)
     * @param {string} filters.createdAfter - Created after date (optional)
     * @param {string} filters.createdBefore - Created before date (optional)
     * @param {number} filters.limit - Limit (default: 100)
     * @param {number} filters.offset - Offset (default: 0)
     * @returns {Promise<Array<Finding>>}
     */
    static async findAll({
        formId = null,
        severity = null,
        department = null,
        status = null,
        createdAfter = null,
        createdBefore = null,
        limit = 100,
        offset = 0
    } = {}) {
        const pool = getPool();
        const whereClauses = [];
        const params = [];
        let paramIndex = 1;

        if (formId) {
            whereClauses.push(`form_id = $${paramIndex++}`);
            params.push(formId);
        }

        if (severity) {
            whereClauses.push(`severity = $${paramIndex++}`);
            params.push(severity);
        }

        if (department) {
            whereClauses.push(`department = $${paramIndex++}`);
            params.push(department);
        }

        if (status) {
            whereClauses.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (createdAfter) {
            whereClauses.push(`created_at >= $${paramIndex++}`);
            params.push(createdAfter);
        }

        if (createdBefore) {
            whereClauses.push(`created_at <= $${paramIndex++}`);
            params.push(createdBefore);
        }

        let query = 'SELECT * FROM public.findings';
        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows.map(row => Finding.fromRow(row));
    }

    /**
     * Update finding by UUID (internal use)
     * @param {string} uuid - UUID only
     * @param {object} updates - Fields to update
     * @returns {Promise<Finding>}
     */
    static async updateById(uuid, updates) {
        const pool = getPool();

        // First verify the finding exists
        const finding = await Finding.findById(uuid);

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        if (updates.severity !== undefined) {
            setClauses.push(`severity = $${paramIndex++}`);
            values.push(updates.severity);
        }

        if (updates.department !== undefined) {
            setClauses.push(`department = $${paramIndex++}`);
            values.push(updates.department);
        }

        if (updates.observation !== undefined) {
            setClauses.push(`observation = $${paramIndex++}`);
            values.push(updates.observation);
        }

        if (updates.rootCause !== undefined) {
            setClauses.push(`root_cause = $${paramIndex++}`);
            values.push(updates.rootCause);
        }

        if (updates.evidenceUrls !== undefined) {
            setClauses.push(`evidence_urls = $${paramIndex++}`);
            values.push(updates.evidenceUrls);
        }

        if (updates.assignment !== undefined) {
            setClauses.push(`assignment = $${paramIndex++}`);
            values.push(JSON.stringify(updates.assignment));
        }

        if (updates.status !== undefined) {
            setClauses.push(`status = $${paramIndex++}`);
            values.push(updates.status);
        }

        if (updates.metadata !== undefined) {
            setClauses.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(updates.metadata));
        }

        if (setClauses.length === 0) {
            return finding;
        }

        values.push(uuid);
        const query = `UPDATE public.findings SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        try {
            const result = await pool.query(query, values);
            return Finding.fromRow(result.rows[0]);
        } catch (error) {
            throw new DatabaseError('Failed to update finding', error);
        }
    }

    /**
     * Delete finding by UUID (internal use)
     * @param {string} uuid - UUID only
     * @returns {Promise<Finding>}
     */
    static async deleteById(uuid) {
        const pool = getPool();

        // First verify the finding exists
        const finding = await Finding.findById(uuid);

        try {
            await pool.query('DELETE FROM public.findings WHERE id = $1', [uuid]);
            return finding;
        } catch (error) {
            throw new DatabaseError('Failed to delete finding', error);
        }
    }

    /**
     * Count findings
     * @param {object} filters
     * @param {string} filters.formId - Form UUID (optional)
     * @param {string} filters.severity - Severity level (optional)
     * @param {string} filters.department - Department (optional)
     * @returns {Promise<number>}
     */
    static async count({ formId = null, questionId = null, severity = null, department = null, status = null } = {}) {
        const pool = getPool();
        const whereClauses = [];
        const params = [];
        let paramIndex = 1;

        if (formId) {
            whereClauses.push(`form_id = $${paramIndex++}`);
            params.push(formId);
        }

        if (questionId) {
            whereClauses.push(`question_id = $${paramIndex++}`);
            params.push(questionId);
        }

        if (severity) {
            whereClauses.push(`severity = $${paramIndex++}`);
            params.push(severity);
        }

        if (department) {
            whereClauses.push(`department = $${paramIndex++}`);
            params.push(department);
        }

        if (status) {
            whereClauses.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        let query = 'SELECT COUNT(*) as count FROM public.findings';
        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count, 10);
    }

    static async getStats(formId) {
        const pool = getPool();

        const summaryResult = await pool.query(
            `SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE cardinality(evidence_urls) > 0) AS with_evidence,
                COUNT(*) FILTER (WHERE jsonb_array_length(assignment) > 0) AS assigned,
                COUNT(*) FILTER (WHERE jsonb_array_length(assignment) = 0) AS unassigned
             FROM public.findings WHERE form_id = $1`,
            [formId]
        );

        const severityResult = await pool.query(
            `SELECT severity, COUNT(*) AS count FROM public.findings
             WHERE form_id = $1 AND severity IS NOT NULL GROUP BY severity`,
            [formId]
        );

        const departmentResult = await pool.query(
            `SELECT department, COUNT(*) AS count FROM public.findings
             WHERE form_id = $1 AND department IS NOT NULL GROUP BY department`,
            [formId]
        );

        const statusResult = await pool.query(
            `SELECT status, COUNT(*) AS count FROM public.findings
             WHERE form_id = $1 AND status IS NOT NULL GROUP BY status`,
            [formId]
        );

        const summary = summaryResult.rows[0];
        return {
            total: parseInt(summary.total, 10),
            bySeverity: Object.fromEntries(severityResult.rows.map(r => [r.severity, parseInt(r.count, 10)])),
            byDepartment: Object.fromEntries(departmentResult.rows.map(r => [r.department, parseInt(r.count, 10)])),
            byStatus: Object.fromEntries(statusResult.rows.map(r => [r.status, parseInt(r.count, 10)])),
            withEvidence: parseInt(summary.with_evidence, 10),
            assigned: parseInt(summary.assigned, 10),
            unassigned: parseInt(summary.unassigned, 10),
        };
    }
}
