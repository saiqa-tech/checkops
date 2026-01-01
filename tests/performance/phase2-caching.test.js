import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LRUCache, CheckOpsCache, checkOpsCache } from '../../src/utils/cache.js';

describe('Phase 2.2: Caching Layer Implementation', () => {
    describe('LRUCache', () => {
        let cache;

        beforeEach(() => {
            cache = new LRUCache(3, 1000); // Small cache for testing
        });

        test('should store and retrieve values', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        test('should return undefined for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        test('should track hit and miss statistics', () => {
            cache.set('key1', 'value1');

            // Hit
            cache.get('key1');

            // Miss
            cache.get('key2');

            const stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe(0.5);
        });

        test('should evict oldest items when at capacity', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4'); // Should evict key1

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBe('value2');
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key4')).toBe('value4');
        });

        test('should update LRU order on access', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            // Access key1 to make it most recently used
            cache.get('key1');

            // Add key4, should evict key2 (oldest)
            cache.set('key4', 'value4');

            expect(cache.get('key1')).toBe('value1'); // Should still exist
            expect(cache.get('key2')).toBeUndefined(); // Should be evicted
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key4')).toBe('value4');
        });

        test('should handle TTL expiration', async () => {
            cache.set('key1', 'value1', 50); // 50ms TTL

            expect(cache.get('key1')).toBe('value1');

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(cache.get('key1')).toBeUndefined();
        });

        test('should provide accurate size and utilization metrics', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            expect(cache.size()).toBe(2);

            const stats = cache.getStats();
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(3);
            expect(stats.utilizationRate).toBe(2 / 3);
        });

        test('should clear all entries and timers', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            cache.clear();

            expect(cache.size()).toBe(0);
            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
        });
    });

    describe('CheckOpsCache', () => {
        let cache;

        beforeEach(() => {
            cache = new CheckOpsCache();
        });

        afterEach(() => {
            cache.clear();
        });

        test('should cache and retrieve forms', () => {
            const form = { id: 'FORM-001', title: 'Test Form' };

            cache.setForm('FORM-001', form);
            const retrieved = cache.getForm('FORM-001');

            expect(retrieved).toEqual(form);
        });

        test('should cache and retrieve questions by ID array', () => {
            const questions = [
                { id: 'Q-001', text: 'Question 1' },
                { id: 'Q-002', text: 'Question 2' }
            ];
            const ids = ['Q-001', 'Q-002'];

            cache.setQuestions(ids, questions);
            const retrieved = cache.getQuestions(ids);

            expect(retrieved).toEqual(questions);
        });

        test('should handle question ID order independence', () => {
            const questions = [
                { id: 'Q-001', text: 'Question 1' },
                { id: 'Q-002', text: 'Question 2' }
            ];

            cache.setQuestions(['Q-002', 'Q-001'], questions);
            const retrieved = cache.getQuestions(['Q-001', 'Q-002']);

            expect(retrieved).toEqual(questions);
        });

        test('should cache and retrieve stats', () => {
            const stats = { totalSubmissions: 100, avgTime: 50 };

            cache.setStats('FORM-001', stats);
            const retrieved = cache.getStats('FORM-001');

            expect(retrieved).toEqual(stats);
        });

        test('should cache and retrieve submissions', () => {
            const submission = { id: 'SUB-001', formId: 'FORM-001', data: {} };

            cache.setSubmission('SUB-001', submission);
            const retrieved = cache.getSubmission('SUB-001');

            expect(retrieved).toEqual(submission);
        });

        test('should invalidate form and related caches', () => {
            const form = { id: 'FORM-001', title: 'Test Form' };
            const stats = { totalSubmissions: 100 };
            const submission = { id: 'SUB-001', formId: 'FORM-001', data: {} };

            cache.setForm('FORM-001', form);
            cache.setStats('FORM-001', stats);
            cache.setSubmission('SUB-001', submission);

            cache.invalidateForm('FORM-001');

            expect(cache.getForm('FORM-001')).toBeUndefined();
            expect(cache.getStats('FORM-001')).toBeUndefined();
            expect(cache.getSubmission('SUB-001')).toBeUndefined();
        });

        test('should provide comprehensive cache statistics', () => {
            // Add some data to different caches
            cache.setForm('FORM-001', { id: 'FORM-001' });
            cache.setQuestions(['Q-001'], [{ id: 'Q-001' }]);
            cache.setStats('FORM-001', { total: 10 });

            // Access some data to generate hits/misses
            cache.getForm('FORM-001'); // hit
            cache.getForm('FORM-002'); // miss

            const stats = cache.getCacheStats();

            expect(stats).toHaveProperty('forms');
            expect(stats).toHaveProperty('questions');
            expect(stats).toHaveProperty('stats');
            expect(stats).toHaveProperty('submissions');
            expect(stats).toHaveProperty('overall');

            expect(stats.overall.totalHits).toBeGreaterThan(0);
            expect(stats.overall.totalMisses).toBeGreaterThan(0);
            expect(stats.overall.totalSize).toBeGreaterThan(0);
        });
    });

    describe('Global CheckOps Cache Instance', () => {
        afterEach(() => {
            checkOpsCache.clear();
        });

        test('should be a singleton instance', () => {
            const cache1 = checkOpsCache;
            const cache2 = checkOpsCache;

            expect(cache1).toBe(cache2);
        });

        test('should maintain state across imports', () => {
            checkOpsCache.setForm('FORM-001', { id: 'FORM-001', title: 'Test' });

            // Simulate another module accessing the cache
            const retrieved = checkOpsCache.getForm('FORM-001');

            expect(retrieved).toEqual({ id: 'FORM-001', title: 'Test' });
        });

        test('should handle concurrent access safely', async () => {
            const concurrentOperations = 50;
            const promises = [];

            // Concurrent writes
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(
                    Promise.resolve().then(() => {
                        checkOpsCache.setForm(`FORM-${i}`, { id: `FORM-${i}`, title: `Form ${i}` });
                    })
                );
            }

            await Promise.all(promises);

            // Verify all writes succeeded
            for (let i = 0; i < concurrentOperations; i++) {
                const form = checkOpsCache.getForm(`FORM-${i}`);
                expect(form).toEqual({ id: `FORM-${i}`, title: `Form ${i}` });
            }

            const stats = checkOpsCache.getCacheStats();
            expect(stats.forms.size).toBe(concurrentOperations);
        });
    });

    describe('Cache Performance', () => {
        test('should provide significant performance improvement over repeated operations', () => {
            const cache = new LRUCache(1000, 60000);
            const testData = Array(100).fill(0).map((_, i) => ({
                key: `key-${i}`,
                value: { id: i, data: `test-data-${i}`.repeat(100) }
            }));

            // Populate cache
            testData.forEach(({ key, value }) => {
                cache.set(key, value);
            });

            // Measure cache access time
            const startTime = performance.now();

            for (let i = 0; i < 1000; i++) {
                const randomKey = `key-${Math.floor(Math.random() * 100)}`;
                cache.get(randomKey);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Cache access should be very fast (less than 10ms for 1000 operations)
            expect(duration).toBeLessThan(10);

            const stats = cache.getStats();
            expect(stats.hitRate).toBeGreaterThan(0.9); // Should have high hit rate
        });
    });
});