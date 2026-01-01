/**
 * Phase 4.4: Monitoring Integration Wrapper
 * Non-invasive monitoring integration for existing services
 */

import { metricsCollector, performanceMonitor } from './metrics.js';

/**
 * Wraps service methods with performance monitoring
 */
export function withMonitoring(serviceClass, methodMappings = {}) {
    const wrappedClass = class extends serviceClass {
        constructor(...args) {
            super(...args);
            this._wrapMethods(methodMappings);
        }

        _wrapMethods(mappings) {
            Object.getOwnPropertyNames(Object.getPrototypeOf(this))
                .filter(name => typeof this[name] === 'function' && name !== 'constructor')
                .forEach(methodName => {
                    const operationName = mappings[methodName] || `${serviceClass.name.toLowerCase()}_${methodName}`;
                    this[methodName] = performanceMonitor.wrapAsync(operationName, this[methodName].bind(this));
                });
        }
    };

    // Preserve the original class name
    Object.defineProperty(wrappedClass, 'name', { value: serviceClass.name });

    return wrappedClass;
}

/**
 * Wraps model static methods with performance monitoring
 */
export function withModelMonitoring(modelClass, methodMappings = {}) {
    const originalMethods = {};

    // Wrap static methods
    Object.getOwnPropertyNames(modelClass)
        .filter(name => typeof modelClass[name] === 'function' && name !== 'constructor')
        .forEach(methodName => {
            const operationName = methodMappings[methodName] || `${modelClass.name.toLowerCase()}_${methodName}`;
            originalMethods[methodName] = modelClass[methodName];

            modelClass[methodName] = performanceMonitor.wrapAsync(operationName, originalMethods[methodName]);
        });

    return {
        restore: () => {
            Object.keys(originalMethods).forEach(methodName => {
                modelClass[methodName] = originalMethods[methodName];
            });
        }
    };
}

/**
 * Database query monitoring wrapper
 */
export function withDatabaseMonitoring(pool) {
    return performanceMonitor.wrapQuery(pool);
}

/**
 * Cache operation monitoring
 */
export function withCacheMonitoring(cacheInstance) {
    const originalGet = cacheInstance.get.bind(cacheInstance);
    const originalSet = cacheInstance.set.bind(cacheInstance);

    cacheInstance.get = function (key) {
        const result = originalGet(key);
        if (result !== undefined) {
            metricsCollector.recordCacheHit();
        } else {
            metricsCollector.recordCacheMiss();
        }
        return result;
    };

    cacheInstance.set = function (key, value, ttl) {
        const start = performance.now();
        const result = originalSet(key, value, ttl);
        const duration = performance.now() - start;
        metricsCollector.recordOperation('cache_set', duration);
        return result;
    };

    return cacheInstance;
}

/**
 * Batch operation monitoring
 */
export function recordBatchOperation(operationName, batchSize, fn) {
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
            metricsCollector.recordBatchOperation(operationName, batchSize, duration, error);
        }
    };
}

/**
 * Validation monitoring
 */
export function recordValidation(itemCount, fn) {
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
            metricsCollector.recordValidation(duration, itemCount, error);
        }
    };
}

/**
 * Connection monitoring
 */
export function recordConnectionMetrics(dbManager) {
    const originalGetPool = dbManager.getPool.bind(dbManager);

    dbManager.getPool = function () {
        const pool = originalGetPool();
        const metrics = dbManager.getMetrics();

        if (metrics) {
            metricsCollector.recordConnection(
                metrics.totalCount - metrics.idleCount, // active connections
                metrics.totalCount, // total connections
                !metrics.isHealthy ? new Error('Database unhealthy') : null
            );
        }

        return pool;
    };

    return dbManager;
}