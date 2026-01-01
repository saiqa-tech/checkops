/**
 * Phase 4.1: Performance Monitoring System
 * Comprehensive metrics collection and performance monitoring
 */

export class MetricsCollector {
    constructor() {
        this.metrics = {
            queries: { count: 0, totalTime: 0, errors: 0 },
            cacheHits: 0,
            cacheMisses: 0,
            operations: new Map(),
            batchOperations: new Map(),
            validations: { count: 0, totalTime: 0, errors: 0 },
            connections: { active: 0, total: 0, errors: 0 },
        };
        this.startTime = Date.now();
        this.maxOperationsHistory = 1000; // Prevent memory leaks
    }

    recordQuery(duration, query, error = null) {
        this.metrics.queries.count++;
        this.metrics.queries.totalTime += duration;
        if (error) {
            this.metrics.queries.errors++;
        }
    }

    recordOperation(operation, duration, error = null) {
        // Prevent memory leaks by limiting operation history
        if (this.metrics.operations.size >= this.maxOperationsHistory) {
            // Remove oldest entries (simple FIFO)
            const firstKey = this.metrics.operations.keys().next().value;
            this.metrics.operations.delete(firstKey);
        }

        if (!this.metrics.operations.has(operation)) {
            this.metrics.operations.set(operation, {
                count: 0,
                totalTime: 0,
                errors: 0,
                minTime: Infinity,
                maxTime: 0
            });
        }
        const op = this.metrics.operations.get(operation);
        op.count++;
        op.totalTime += duration;
        op.minTime = Math.min(op.minTime, duration);
        op.maxTime = Math.max(op.maxTime, duration);
        if (error) {
            op.errors++;
        }
    }

    recordBatchOperation(operation, batchSize, duration, error = null) {
        // Prevent memory leaks by limiting batch operation history
        if (this.metrics.batchOperations.size >= this.maxOperationsHistory) {
            const firstKey = this.metrics.batchOperations.keys().next().value;
            this.metrics.batchOperations.delete(firstKey);
        }

        if (!this.metrics.batchOperations.has(operation)) {
            this.metrics.batchOperations.set(operation, {
                count: 0,
                totalItems: 0,
                totalTime: 0,
                errors: 0,
                avgBatchSize: 0,
                avgTimePerItem: 0
            });
        }
        const op = this.metrics.batchOperations.get(operation);
        op.count++;
        op.totalItems += batchSize;
        op.totalTime += duration;
        op.avgBatchSize = op.totalItems / op.count;
        op.avgTimePerItem = op.totalTime / op.totalItems;
        if (error) {
            op.errors++;
        }
    }

    recordValidation(duration, itemCount = 1, error = null) {
        this.metrics.validations.count += itemCount;
        this.metrics.validations.totalTime += duration;
        if (error) {
            this.metrics.validations.errors++;
        }
    }

    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    recordConnection(active, total, error = null) {
        this.metrics.connections.active = active;
        this.metrics.connections.total = total;
        if (error) {
            this.metrics.connections.errors++;
        }
    }

    getMetrics() {
        const operations = {};
        this.metrics.operations.forEach((value, key) => {
            operations[key] = {
                count: value.count,
                avgTime: value.totalTime / value.count,
                minTime: value.minTime === Infinity ? 0 : value.minTime,
                maxTime: value.maxTime,
                totalTime: value.totalTime,
                errors: value.errors,
                errorRate: (value.errors / value.count) * 100
            };
        });

        const batchOperations = {};
        this.metrics.batchOperations.forEach((value, key) => {
            batchOperations[key] = {
                batchCount: value.count,
                totalItems: value.totalItems,
                avgBatchSize: value.avgBatchSize,
                avgTimePerItem: value.avgTimePerItem,
                totalTime: value.totalTime,
                errors: value.errors,
                errorRate: (value.errors / value.count) * 100
            };
        });

        const uptime = Date.now() - this.startTime;

        return {
            uptime: uptime,
            queries: {
                count: this.metrics.queries.count,
                avgTime: this.metrics.queries.totalTime / this.metrics.queries.count || 0,
                totalTime: this.metrics.queries.totalTime,
                errors: this.metrics.queries.errors,
                errorRate: (this.metrics.queries.errors / this.metrics.queries.count) * 100 || 0,
                qps: this.metrics.queries.count / (uptime / 1000) || 0 // Queries per second
            },
            validations: {
                count: this.metrics.validations.count,
                avgTime: this.metrics.validations.totalTime / this.metrics.validations.count || 0,
                totalTime: this.metrics.validations.totalTime,
                errors: this.metrics.validations.errors,
                errorRate: (this.metrics.validations.errors / this.metrics.validations.count) * 100 || 0,
                vps: this.metrics.validations.count / (uptime / 1000) || 0 // Validations per second
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
                total: this.metrics.cacheHits + this.metrics.cacheMisses
            },
            connections: {
                active: this.metrics.connections.active,
                total: this.metrics.connections.total,
                errors: this.metrics.connections.errors
            },
            operations,
            batchOperations
        };
    }

    getPerformanceSummary() {
        const metrics = this.getMetrics();

        return {
            overview: {
                uptime: `${Math.round(metrics.uptime / 1000)}s`,
                totalQueries: metrics.queries.count,
                avgQueryTime: `${metrics.queries.avgTime.toFixed(2)}ms`,
                cacheHitRate: `${(metrics.cache.hitRate * 100).toFixed(1)}%`,
                errorRate: `${metrics.queries.errorRate.toFixed(2)}%`
            },
            performance: {
                queriesPerSecond: metrics.queries.qps.toFixed(2),
                validationsPerSecond: metrics.validations.vps.toFixed(2),
                avgValidationTime: `${metrics.validations.avgTime.toFixed(3)}ms`,
                connectionUtilization: `${metrics.connections.active}/${metrics.connections.total}`
            },
            topOperations: Object.entries(metrics.operations)
                .sort(([, a], [, b]) => b.count - a.count)
                .slice(0, 5)
                .map(([name, stats]) => ({
                    operation: name,
                    count: stats.count,
                    avgTime: `${stats.avgTime.toFixed(2)}ms`,
                    errorRate: `${stats.errorRate.toFixed(1)}%`
                })),
            batchEfficiency: Object.entries(metrics.batchOperations)
                .map(([name, stats]) => ({
                    operation: name,
                    avgBatchSize: Math.round(stats.avgBatchSize),
                    avgTimePerItem: `${stats.avgTimePerItem.toFixed(3)}ms`,
                    totalItems: stats.totalItems
                }))
        };
    }

    reset() {
        this.metrics = {
            queries: { count: 0, totalTime: 0, errors: 0 },
            cacheHits: 0,
            cacheMisses: 0,
            operations: new Map(),
            batchOperations: new Map(),
            validations: { count: 0, totalTime: 0, errors: 0 },
            connections: { active: 0, total: 0, errors: 0 },
        };
        this.startTime = Date.now();
    }

    exportMetrics() {
        return {
            timestamp: new Date().toISOString(),
            metrics: this.getMetrics(),
            summary: this.getPerformanceSummary()
        };
    }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

/**
 * Performance monitoring middleware for automatic metrics collection
 */
export class PerformanceMonitor {
    constructor(metricsCollector) {
        this.metrics = metricsCollector;
    }

    // Decorator for monitoring function performance
    monitor(operationName) {
        return (target, propertyKey, descriptor) => {
            const originalMethod = descriptor.value;

            descriptor.value = async function (...args) {
                const start = performance.now();
                let error = null;

                try {
                    const result = await originalMethod.apply(this, args);
                    return result;
                } catch (err) {
                    error = err;
                    throw err;
                } finally {
                    const duration = performance.now() - start;
                    this.metrics.recordOperation(operationName, duration, error);
                }
            };

            return descriptor;
        };
    }

    // Wrapper for monitoring async functions
    wrapAsync(operationName, fn) {
        return async (...args) => {
            const start = performance.now();
            let error = null;

            try {
                const result = await fn(...args);
                return result;
            } catch (err) {
                error = err;
                throw err;
            } finally {
                const duration = performance.now() - start;
                this.metrics.recordOperation(operationName, duration, error);
            }
        };
    }

    // Monitor database queries
    wrapQuery(pool) {
        const originalQuery = pool.query.bind(pool);

        pool.query = async (text, params) => {
            const start = performance.now();
            let error = null;

            try {
                const result = await originalQuery(text, params);
                return result;
            } catch (err) {
                error = err;
                throw err;
            } finally {
                const duration = performance.now() - start;
                this.metrics.recordQuery(duration, text, error);
            }
        };

        return pool;
    }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor(metricsCollector);