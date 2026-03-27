/**
 * ID Resolver Utility for v4.0.0 Dual-ID System
 * 
 * Handles resolution of both UUID and SID (human-readable) identifiers.
 * Provides backward compatibility for v3.x code that uses SIDs.
 */

import { getPool, getPoolUnsafe } from '../config/database.js';

/**
 * Check if a string is a valid UUID
 * @param {string} id - The ID to check
 * @returns {boolean} True if valid UUID format
 */
export function isUUID(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * Check if a string is a valid SID format
 * @param {string} id - The ID to check
 * @param {string} prefix - Expected prefix (FORM, Q, SUB)
 * @returns {boolean} True if valid SID format
 */
export function isSID(id, prefix = null) {
    if (!id || typeof id !== 'string') {
        return false;
    }

    if (prefix) {
        const sidRegex = new RegExp(`^${prefix}-\\d+$`);
        return sidRegex.test(id);
    }

    // Generic SID check (any prefix)
    const genericSidRegex = /^[A-Z]+-\d+$/;
    return genericSidRegex.test(id);
}

/**
 * Resolve an ID (UUID or SID) to a UUID
 * @param {string} id - The ID to resolve (UUID or SID)
 * @param {string} tableName - The table name (forms, question_bank, submissions)
 * @param {object} client - Optional database client for transactions
 * @returns {Promise<string|null>} The UUID, or null if not found
 */
export async function resolveToUUID(id, tableName, client = null) {
    if (!id) {
        return null;
    }

    // If already a UUID, return it
    if (isUUID(id)) {
        return id;
    }

    // If it's a SID, look up the UUID
    if (isSID(id)) {
        const pool = client || getPool();
        const result = await pool.query(
            `SELECT id FROM ${tableName} WHERE sid = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].id;
    }

    // Invalid format
    return null;
}

/**
 * Resolve an ID (UUID or SID) to a SID
 * @param {string} id - The ID to resolve (UUID or SID)
 * @param {string} tableName - The table name (forms, question_bank, submissions)
 * @param {object} client - Optional database client for transactions
 * @returns {Promise<string|null>} The SID, or null if not found
 */
export async function resolveToSID(id, tableName, client = null) {
    if (!id) {
        return null;
    }

    // If already a SID, return it
    if (isSID(id)) {
        return id;
    }

    // If it's a UUID, look up the SID
    if (isUUID(id)) {
        const pool = client || getPool();
        const result = await pool.query(
            `SELECT sid FROM ${tableName} WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0].sid;
    }

    // Invalid format
    return null;
}

/**
 * Resolve multiple IDs to UUIDs
 * @param {string[]} ids - Array of IDs to resolve
 * @param {string} tableName - The table name
 * @param {object} client - Optional database client
 * @returns {Promise<string[]>} Array of UUIDs (nulls for not found)
 */
export async function resolveMultipleToUUID(ids, tableName, client = null) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    return Promise.all(
        ids.map(id => resolveToUUID(id, tableName, client))
    );
}

/**
 * Validate ID format (UUID or SID)
 * @param {string} id - The ID to validate
 * @param {string} prefix - Optional expected SID prefix
 * @returns {boolean} True if valid UUID or SID
 */
export function isValidID(id, prefix = null) {
    return isUUID(id) || isSID(id, prefix);
}

/**
 * Get ID type
 * @param {string} id - The ID to check
 * @returns {string} 'uuid', 'sid', or 'invalid'
 */
export function getIDType(id) {
    if (isUUID(id)) {
        return 'uuid';
    }
    if (isSID(id)) {
        return 'sid';
    }
    return 'invalid';
}

/**
 * Generate a new SID for a given entity type
 * This is used when creating new records
 * @param {string} entityType - 'form', 'question', 'submission', or 'finding'
 * @param {number} counter - The counter value
 * @returns {string} The generated SID
 */
export function generateSID(entityType, counter) {
    const prefixes = {
        form: 'FORM',
        question: 'Q',
        submission: 'SUB',
        finding: 'FND'
    };

    const prefix = prefixes[entityType];
    if (!prefix) {
        throw new Error(`Invalid entity type: ${entityType}`);
    }

    return `${prefix}-${String(counter).padStart(3, '0')}`;
}

/**
 * Get the next SID counter value from the database using atomic counter
 * Note: In v4.0.0, we use a dedicated sid_counters table with atomic increments
 * to prevent concurrent SID conflicts
 * 
 * @param {string} entityType - 'form', 'question', 'submission', or 'finding'
 * @param {object} client - Optional database client
 * @returns {Promise<number>} The next counter value
 */
export async function getNextSIDCounter(entityType, client = null) {
    // Use getPoolUnsafe to allow operations even if health check fails
    // This is needed for test cleanup scenarios
    const pool = client || getPoolUnsafe();

    // Validate entity type
    const validTypes = ['form', 'question', 'submission', 'finding'];
    if (!validTypes.includes(entityType)) {
        throw new Error(`Invalid entity type: ${entityType}`);
    }

    // Use PostgreSQL function for atomic counter increment
    // This prevents concurrent SID conflicts without advisory locks
    // Cast to VARCHAR to match function signature
    const result = await pool.query(
        'SELECT get_next_sid_counter($1::VARCHAR) AS next_counter',
        [entityType]
    );

    return result.rows[0].next_counter;
}

/**
 * Batch resolve IDs to UUIDs with caching
 * More efficient for bulk operations
 * @param {string[]} ids - Array of IDs to resolve
 * @param {string} tableName - The table name
 * @param {object} client - Optional database client
 * @returns {Promise<Map<string, string>>} Map of input ID -> UUID
 */
export async function batchResolveToUUID(ids, tableName, client = null) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Map();
    }

    const pool = client || getPool();
    const resultMap = new Map();

    // Separate UUIDs and SIDs
    const uuids = ids.filter(id => isUUID(id));
    const sids = ids.filter(id => isSID(id));

    // UUIDs map to themselves
    uuids.forEach(uuid => resultMap.set(uuid, uuid));

    // Batch lookup SIDs
    if (sids.length > 0) {
        const result = await pool.query(
            `SELECT sid, id FROM ${tableName} WHERE sid = ANY($1)`,
            [sids]
        );

        result.rows.forEach(row => {
            resultMap.set(row.sid, row.id);
        });
    }

    return resultMap;
}
