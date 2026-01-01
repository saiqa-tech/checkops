/**
 * Phase 3.3: Advanced Query Optimization
 * Intelligent query building and optimization utilities
 */

import { getPool } from '../config/database.js';

/**
 * Query Builder for dynamic, optimized SQL generation
 */
export class QueryBuilder {
    constructor(tableName) {
        this.tableName = tableName;
        this.selectFields = ['*'];
        this.whereConditions = [];
        this.joinClauses = [];
        this.orderByFields = [];
        this.limitValue = null;
        this.offsetValue = null;
        this.parameters = [];
        this.paramIndex = 1;
    }

    select(fields) {
        if (Array.isArray(fields)) {
            this.selectFields = fields;
        } else if (typeof fields === 'string') {
            this.selectFields = [fields];
        }
        return this;
    }

    where(condition, value) {
        if (value !== undefined && value !== null) {
            this.whereConditions.push(`${condition} = $${this.paramIndex++}`);
            this.parameters.push(value);
        }
        return this;
    }

    whereIn(field, values) {
        if (Array.isArray(values) && values.length > 0) {
            const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
            this.whereConditions.push(`${field} IN (${placeholders})`);
            this.parameters.push(...values);
        }
        return this;
    }

    whereLike(field, value) {
        if (value) {
            this.whereConditions.push(`${field} ILIKE $${this.paramIndex++}`);
            this.parameters.push(`%${value}%`);
        }
        return this;
    }

    whereRange(field, min, max) {
        if (min !== undefined && min !== null) {
            this.whereConditions.push(`${field} >= $${this.paramIndex++}`);
            this.parameters.push(min);
        }
        if (max !== undefined && max !== null) {
            this.whereConditions.push(`${field} <= $${this.paramIndex++}`);
            this.parameters.push(max);
        }
        return this;
    }

    join(table, condition) {
        this.joinClauses.push(`JOIN ${table} ON ${condition}`);
        return this;
    }

    leftJoin(table, condition) {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
    }

    orderBy(field, direction = 'ASC') {
        this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
        return this;
    }

    limit(count) {
        if (count > 0) {
            this.limitValue = count;
        }
        return this;
    }

    offset(count) {
        if (count >= 0) {
            this.offsetValue = count;
        }
        return this;
    }

    build() {
        let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;

        if (this.joinClauses.length > 0) {
            query += ` ${this.joinClauses.join(' ')}`;
        }

        if (this.whereConditions.length > 0) {
            query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }

        if (this.orderByFields.length > 0) {
            query += ` ORDER BY ${this.orderByFields.join(', ')}`;
        }

        if (this.limitValue !== null) {
            query += ` LIMIT $${this.paramIndex++}`;
            this.parameters.push(this.limitValue);
        }

        if (this.offsetValue !== null) {
            query += ` OFFSET $${this.paramIndex++}`;
            this.parameters.push(this.offsetValue);
        }

        return {
            query,
            parameters: this.parameters
        };
    }

    async execute() {
        const { query, parameters } = this.build();
        const pool = getPool();
        return await pool.query(query, parameters);
    }
}

/**
 * Optimized pagination with cursor-based approach for large datasets
 */
export class CursorPaginator {
    constructor(tableName, cursorField = 'id') {
        this.tableName = tableName;
        this.cursorField = cursorField;
    }

    async paginate({
        cursor = null,
        limit = 50,
        direction = 'forward',
        whereConditions = [],
        orderBy = null
    }) {
        const pool = getPool();
        const parameters = [];
        let paramIndex = 1;

        // Build base query
        let query = `SELECT * FROM ${this.tableName}`;

        // Add where conditions
        const conditions = [...whereConditions];

        // Add cursor condition
        if (cursor) {
            const operator = direction === 'forward' ? '>' : '<';
            conditions.push(`${this.cursorField} ${operator} $${paramIndex++}`);
            parameters.push(cursor);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        // Add ordering
        const orderDirection = direction === 'forward' ? 'ASC' : 'DESC';
        const orderField = orderBy || this.cursorField;
        query += ` ORDER BY ${orderField} ${orderDirection}`;

        // Add limit
        query += ` LIMIT $${paramIndex++}`;
        parameters.push(limit + 1); // Fetch one extra to check if there are more

        const result = await pool.query(query, parameters);
        const rows = result.rows;

        const hasMore = rows.length > limit;
        if (hasMore) {
            rows.pop(); // Remove the extra row
        }

        const nextCursor = rows.length > 0 ? rows[rows.length - 1][this.cursorField] : null;
        const prevCursor = rows.length > 0 ? rows[0][this.cursorField] : null;

        return {
            data: rows,
            hasMore,
            nextCursor,
            prevCursor,
            totalFetched: rows.length
        };
    }
}

/**
 * Intelligent query caching with automatic invalidation
 */
export class QueryCache {
    constructor() {
        this.cache = new Map();
        this.dependencies = new Map(); // Track which tables each query depends on
    }

    generateKey(query, parameters) {
        return `${query}:${JSON.stringify(parameters)}`;
    }

    set(query, parameters, result, dependencies = []) {
        const key = this.generateKey(query, parameters);
        this.cache.set(key, {
            result,
            timestamp: Date.now(),
            dependencies
        });

        // Track dependencies
        dependencies.forEach(table => {
            if (!this.dependencies.has(table)) {
                this.dependencies.set(table, new Set());
            }
            this.dependencies.get(table).add(key);
        });
    }

    get(query, parameters) {
        const key = this.generateKey(query, parameters);
        const cached = this.cache.get(key);

        if (!cached) {
            return null;
        }

        // Check if cache is still valid (5 minutes TTL)
        if (Date.now() - cached.timestamp > 300000) {
            this.cache.delete(key);
            return null;
        }

        return cached.result;
    }

    invalidateTable(tableName) {
        const keysToInvalidate = this.dependencies.get(tableName);
        if (keysToInvalidate) {
            keysToInvalidate.forEach(key => {
                this.cache.delete(key);
            });
            this.dependencies.delete(tableName);
        }
    }

    clear() {
        this.cache.clear();
        this.dependencies.clear();
    }

    getStats() {
        return {
            cacheSize: this.cache.size,
            dependencyCount: this.dependencies.size
        };
    }
}

// Global query cache instance
export const queryCache = new QueryCache();

/**
 * Optimized bulk operations with batching
 */
export class BulkOperationOptimizer {
    static async batchInsert(tableName, records, batchSize = 100) {
        if (!Array.isArray(records) || records.length === 0) {
            return [];
        }

        const pool = getPool();
        const results = [];

        // Process in batches to avoid parameter limits
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            // Build bulk insert query
            const fields = Object.keys(batch[0]);
            const values = [];
            const placeholders = [];
            let paramIndex = 1;

            batch.forEach(record => {
                const recordPlaceholders = fields.map(() => `$${paramIndex++}`);
                placeholders.push(`(${recordPlaceholders.join(', ')})`);
                values.push(...fields.map(field => record[field]));
            });

            const query = `
        INSERT INTO ${tableName} (${fields.join(', ')})
        VALUES ${placeholders.join(', ')}
        RETURNING *
      `;

            const result = await pool.query(query, values);
            results.push(...result.rows);
        }

        return results;
    }

    static async batchUpdate(tableName, updates, keyField = 'id', batchSize = 50) {
        if (!Array.isArray(updates) || updates.length === 0) {
            return [];
        }

        const pool = getPool();
        const client = await pool.connect();
        const results = [];

        try {
            await client.query('BEGIN');

            // Process in batches
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);

                for (const update of batch) {
                    const { [keyField]: keyValue, ...updateData } = update;

                    const setClauses = [];
                    const values = [];
                    let paramIndex = 1;

                    Object.entries(updateData).forEach(([field, value]) => {
                        setClauses.push(`${field} = $${paramIndex++}`);
                        values.push(value);
                    });

                    values.push(keyValue);
                    const query = `
            UPDATE ${tableName} 
            SET ${setClauses.join(', ')} 
            WHERE ${keyField} = $${paramIndex}
            RETURNING *
          `;

                    const result = await client.query(query, values);
                    if (result.rows.length > 0) {
                        results.push(result.rows[0]);
                    }
                }
            }

            await client.query('COMMIT');
            return results;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async batchDelete(tableName, ids, keyField = 'id', batchSize = 100) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const pool = getPool();
        const results = [];

        // Process in batches
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);

            const placeholders = batch.map((_, index) => `$${index + 1}`).join(', ');
            const query = `
        DELETE FROM ${tableName} 
        WHERE ${keyField} IN (${placeholders})
        RETURNING *
      `;

            const result = await pool.query(query, batch);
            results.push(...result.rows);
        }

        return results;
    }
}

/**
 * Database statistics and query analysis
 */
export class QueryAnalyzer {
    static async analyzeTableStats(tableName) {
        const pool = getPool();

        const query = `
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE tablename = $1
    `;

        const result = await pool.query(query, [tableName]);
        return result.rows;
    }

    static async getTableSize(tableName) {
        const pool = getPool();

        const query = `
      SELECT 
        pg_size_pretty(pg_total_relation_size($1)) as total_size,
        pg_size_pretty(pg_relation_size($1)) as table_size,
        pg_size_pretty(pg_total_relation_size($1) - pg_relation_size($1)) as index_size
    `;

        const result = await pool.query(query, [tableName]);
        return result.rows[0];
    }

    static async explainQuery(query, parameters = []) {
        const pool = getPool();

        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
        const result = await pool.query(explainQuery, parameters);

        return result.rows[0]['QUERY PLAN'][0];
    }

    static async getSlowQueries(limit = 10) {
        const pool = getPool();

        const query = `
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      ORDER BY mean_time DESC 
      LIMIT $1
    `;

        try {
            const result = await pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            // pg_stat_statements extension might not be installed
            return [];
        }
    }
}