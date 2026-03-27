/**
 * Finding Service - v4.0.0
 * 
 * Service layer for Finding operations.
 * Handles business logic and wraps model methods.
 */

import { Finding } from '../models/Finding.js';
import { isUUID } from '../utils/idResolver.js';
import { ValidationError } from '../utils/errors.js';

export class FindingService {
    /**
     * Create a new finding
     * @param {object} params - Finding creation parameters
     * @returns {Promise<Finding>}
     */
    async createFinding({
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
        // Validate required UUIDs
        if (!submissionId || !isUUID(submissionId)) {
            throw new ValidationError('Valid submissionId (UUID) is required');
        }

        if (!questionId || !isUUID(questionId)) {
            throw new ValidationError('Valid questionId (UUID) is required');
        }

        if (!formId || !isUUID(formId)) {
            throw new ValidationError('Valid formId (UUID) is required');
        }

        // Validate assignment is an array
        if (assignment && !Array.isArray(assignment)) {
            throw new ValidationError('assignment must be an array');
        }

        // Validate metadata is an object
        if (metadata && typeof metadata !== 'object') {
            throw new ValidationError('metadata must be an object');
        }

        return await Finding.create({
            submissionId,
            questionId,
            formId,
            severity,
            department,
            observation,
            rootCause,
            evidenceUrls,
            assignment,
            status,
            metadata,
            createdBy
        });
    }

    /**
     * Get finding by UUID
     * @param {string} id - Finding UUID
     * @returns {Promise<Finding>}
     */
    async getFindingById(id) {
        if (!id || !isUUID(id)) {
            throw new ValidationError('Valid finding UUID is required');
        }

        return await Finding.findById(id);
    }

    /**
     * Get findings by form UUID
     * @param {string} formId - Form UUID
     * @param {object} options - Pagination options
     * @returns {Promise<Array<Finding>>}
     */
    async getFindingsByFormId(formId, options = {}) {
        if (!formId || !isUUID(formId)) {
            throw new ValidationError('Valid form UUID is required');
        }

        return await Finding.findByFormId(formId, options);
    }

    /**
     * Get findings by submission UUID
     * @param {string} submissionId - Submission UUID
     * @returns {Promise<Array<Finding>>}
     */
    async getFindingsBySubmissionId(submissionId) {
        if (!submissionId || !isUUID(submissionId)) {
            throw new ValidationError('Valid submission UUID is required');
        }

        return await Finding.findBySubmissionId(submissionId);
    }

    /**
     * Get findings by question UUID
     * @param {string} questionId - Question UUID
     * @param {object} options - Pagination options
     * @returns {Promise<Array<Finding>>}
     */
    async getFindingsByQuestionId(questionId, options = {}) {
        if (!questionId || !isUUID(questionId)) {
            throw new ValidationError('Valid question UUID is required');
        }

        return await Finding.findByQuestionId(questionId, options);
    }

    /**
     * Get all findings with filters
     * @param {object} filters - Filter options
     * @returns {Promise<Array<Finding>>}
     */
    async getFindings(filters = {}) {
        return await Finding.findAll(filters);
    }

    /**
     * Update finding by UUID
     * @param {string} id - Finding UUID
     * @param {object} updates - Fields to update
     * @returns {Promise<Finding>}
     */
    async updateFindingById(id, updates) {
        if (!id || !isUUID(id)) {
            throw new ValidationError('Valid finding UUID is required');
        }

        // Validate assignment if provided
        if (updates.assignment !== undefined && !Array.isArray(updates.assignment)) {
            throw new ValidationError('assignment must be an array');
        }

        // Validate metadata if provided
        if (updates.metadata !== undefined && typeof updates.metadata !== 'object') {
            throw new ValidationError('metadata must be an object');
        }

        return await Finding.updateById(id, updates);
    }

    /**
     * Delete finding by UUID
     * @param {string} id - Finding UUID
     * @returns {Promise<Finding>}
     */
    async deleteFindingById(id) {
        if (!id || !isUUID(id)) {
            throw new ValidationError('Valid finding UUID is required');
        }

        return await Finding.deleteById(id);
    }

    /**
     * Count findings with filters
     * @param {object} filters - Filter options
     * @returns {Promise<number>}
     */
    async getFindingCount(filters = {}) {
        return await Finding.count(filters);
    }

    async getFindingsStats(formId) {
        if (!formId || !isUUID(formId)) {
            throw new ValidationError('Valid form UUID is required');
        }
        return await Finding.getStats(formId);
    }
}
