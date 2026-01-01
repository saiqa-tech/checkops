import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase, closeDatabase, getMetrics, testConnection, dbManager } from '../../src/config/database.js';

describe('Phase 2.1: Enhanced Connection Pool Management', () => {
    beforeAll(async () => {
        await initializeDatabase({
            host: 'localhost',
            port: 5432,
            database: 'checkops_test',
            user: 'postgres',
            password: 'password',
        });
    });

    afterAll(async () => {
        await closeDatabase();
    });

    test('should initialize database with enhanced pool settings', async () => {
        const metrics = getMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.isHealthy).toBe(true);
        expect(metrics.totalCount).toBeGreaterThanOrEqual(0);
        expect(metrics.idleCount).toBeGreaterThanOrEqual(0);
        expect(metrics.waitingCount).toBe(0);
    });

    test('should handle connection health checks', async () => {
        const isHealthy = await testConnection();
        expect(isHealthy).toBe(true);

        const metrics = getMetrics();
        expect(metrics.isHealthy).toBe(true);
        expect(metrics.totalQueries).toBeGreaterThan(0);
    });

    test('should track connection pool metrics', async () => {
        const initialMetrics = getMetrics();

        // Perform some database operations
        await testConnection();
        await testConnection();
        await testConnection();

        const finalMetrics = getMetrics();

        expect(finalMetrics.totalQueries).toBeGreaterThan(initialMetrics.totalQueries);
        expect(finalMetrics.avgQueryTime).toBeGreaterThan(0);
        expect(finalMetrics.poolUtilization).toBeGreaterThanOrEqual(0);
        expect(finalMetrics.poolUtilization).toBeLessThanOrEqual(1);
    });

    test('should handle concurrent connections efficiently', async () => {
        const concurrentOperations = 20;
        const startTime = performance.now();

        // Create multiple concurrent connection requests
        const promises = Array(concurrentOperations).fill(0).map(() => testConnection());

        const results = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // All operations should succeed
        expect(results.every(result => result === true)).toBe(true);

        // Should complete within reasonable time (less than 1 second for 20 operations)
        expect(duration).toBeLessThan(1000);

        const metrics = getMetrics();
        expect(metrics.errors).toBe(0);
        expect(metrics.connectionErrors).toBe(0);
    });

    test('should emit proper events', (done) => {
        let eventsReceived = 0;
        const expectedEvents = ['pool-connect', 'pool-acquire'];

        const eventHandler = (eventName) => {
            eventsReceived++;
            if (eventsReceived === expectedEvents.length) {
                done();
            }
        };

        // Listen for events
        dbManager.on('pool-connect', () => eventHandler('pool-connect'));
        dbManager.on('pool-acquire', () => eventHandler('pool-acquire'));

        // Trigger events by making a connection
        testConnection().catch(done);

        // Timeout after 5 seconds
        setTimeout(() => {
            if (eventsReceived < expectedEvents.length) {
                done(new Error(`Only received ${eventsReceived} out of ${expectedEvents.length} expected events`));
            }
        }, 5000);
    });

    test('should maintain connection pool within limits', async () => {
        const metrics = getMetrics();
        const maxConnections = 25; // Default max from our config

        expect(metrics.totalCount).toBeLessThanOrEqual(maxConnections);
        expect(metrics.idleCount).toBeLessThanOrEqual(metrics.totalCount);
        expect(metrics.waitingCount).toBeGreaterThanOrEqual(0);
    });

    test('should provide comprehensive metrics', () => {
        const metrics = getMetrics();

        // Check all expected metrics are present
        expect(metrics).toHaveProperty('totalCount');
        expect(metrics).toHaveProperty('idleCount');
        expect(metrics).toHaveProperty('waitingCount');
        expect(metrics).toHaveProperty('isHealthy');
        expect(metrics).toHaveProperty('reconnectAttempts');
        expect(metrics).toHaveProperty('totalQueries');
        expect(metrics).toHaveProperty('avgQueryTime');
        expect(metrics).toHaveProperty('errors');
        expect(metrics).toHaveProperty('connectionErrors');
        expect(metrics).toHaveProperty('poolUtilization');

        // Check metric types
        expect(typeof metrics.totalCount).toBe('number');
        expect(typeof metrics.isHealthy).toBe('boolean');
        expect(typeof metrics.poolUtilization).toBe('number');
    });
});