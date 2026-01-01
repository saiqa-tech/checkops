/**
 * N+1 Query Optimization Performance Test
 * 
 * This test validates that the N+1 query problem has been resolved
 * and measures the performance improvement.
 */

import { jest } from '@jest/globals';
import { FormService } from '../../src/services/FormService.js';
import { Question } from '../../src/models/Question.js';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';

describe('N+1 Query Optimization Performance', () => {
    let formService;
    let originalFindById;
    let originalFindByIds;
    let findByIdCallCount = 0;
    let findByIdsCallCount = 0;

    beforeAll(async () => {
        // Initialize test database
        await initializeDatabase({
            host: process.env.TEST_DB_HOST || 'localhost',
            port: process.env.TEST_DB_PORT || 5432,
            database: process.env.TEST_DB_NAME || 'checkops_test',
            user: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || '',
        });

        formService = new FormService();

        // Mock both methods to track usage
        originalFindById = Question.findById;
        originalFindByIds = Question.findByIds;

        Question.findById = jest.fn().mockImplementation(async (id) => {
            findByIdCallCount++;
            return originalFindById.call(Question, id);
        });

        Question.findByIds = jest.fn().mockImplementation(async (ids) => {
            findByIdsCallCount++;
            return originalFindByIds.call(Question, ids);
        });
    });

    afterAll(async () => {
        // Restore original methods
        Question.findById = originalFindById;
        Question.findByIds = originalFindByIds;
        await closeDatabase();
    });

    beforeEach(() => {
        findByIdCallCount = 0;
        findByIdsCallCount = 0;
        Question.findById.mockClear();
        Question.findByIds.mockClear();
    });

    test('should use batch query instead of individual queries', async () => {
        const questions = Array(10).fill(0).map((_, i) => ({
            questionId: `test-question-${i}`,
            questionText: `Override text ${i}`,
            required: true,
        }));

        console.log(`\n🚀 OPTIMIZATION TEST: Enriching ${questions.length} questions`);
        console.log('Expected: 1 batch query (findByIds)');
        console.log('Expected: 0 individual queries (findById)');

        const startTime = performance.now();

        try {
            await formService.enrichQuestions(questions);
        } catch (error) {
            // Expected to fail since test questions don't exist
            // We're measuring query patterns
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`Actual findById calls: ${findByIdCallCount}`);
        console.log(`Actual findByIds calls: ${findByIdsCallCount}`);
        console.log(`Time taken: ${duration.toFixed(2)}ms`);

        // Verify optimization worked
        expect(findByIdCallCount).toBe(0); // No individual queries
        expect(findByIdsCallCount).toBe(1); // Single batch query

        console.log('\n✅ OPTIMIZATION METRICS:');
        console.log(`- Questions processed: ${questions.length}`);
        console.log(`- Individual queries (findById): ${findByIdCallCount}`);
        console.log(`- Batch queries (findByIds): ${findByIdsCallCount}`);
        console.log(`- Query reduction: ${questions.length - findByIdsCallCount} fewer queries`);
        console.log(`- Total time: ${duration.toFixed(2)}ms`);
    });

    test('should maintain constant query count regardless of question count', async () => {
        const testSizes = [5, 10, 20, 50, 100];
        const results = [];

        for (const size of testSizes) {
            findByIdCallCount = 0;
            findByIdsCallCount = 0;
            Question.findById.mockClear();
            Question.findByIds.mockClear();

            const questions = Array(size).fill(0).map((_, i) => ({
                questionId: `test-question-${i}`,
                questionText: `Override text ${i}`,
            }));

            const startTime = performance.now();

            try {
                await formService.enrichQuestions(questions);
            } catch (error) {
                // Expected to fail
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            results.push({
                questionCount: size,
                findByIdCalls: findByIdCallCount,
                findByIdsCalls: findByIdsCallCount,
                totalQueries: findByIdCallCount + findByIdsCallCount,
                duration: duration.toFixed(2),
            });

            // Verify constant query count (O(1) instead of O(n))
            expect(findByIdCallCount).toBe(0);
            expect(findByIdsCallCount).toBe(1);
        }

        console.log('\n📊 SCALING ANALYSIS (OPTIMIZED):');
        console.log('Questions | findById | findByIds | Total | Time(ms)');
        console.log('----------|----------|-----------|-------|----------');
        results.forEach(r => {
            console.log(`${r.questionCount.toString().padStart(9)} | ${r.findByIdCalls.toString().padStart(8)} | ${r.findByIdsCalls.toString().padStart(9)} | ${r.totalQueries.toString().padStart(5)} | ${r.duration.padStart(8)}`);
        });

        // Verify constant query pattern (O(1))
        results.forEach(result => {
            expect(result.findByIdCalls).toBe(0);
            expect(result.findByIdsCalls).toBe(1);
            expect(result.totalQueries).toBe(1);
        });

        console.log('\n🎯 OPTIMIZATION SUCCESS:');
        console.log('- Query complexity: O(1) instead of O(n)');
        console.log('- Consistent single batch query regardless of question count');
        console.log('- No individual findById calls');
    });

    test('should handle mixed scenarios (some questions with questionId, some without)', async () => {
        const questions = [
            { questionText: 'Direct question 1', questionType: 'text' }, // No questionId
            { questionId: 'bank-1', questionText: 'Override 1' }, // With questionId
            { questionText: 'Direct question 2', questionType: 'select' }, // No questionId
            { questionId: 'bank-2', questionText: 'Override 2' }, // With questionId
            { questionId: 'bank-1', questionText: 'Override 1 again' }, // Duplicate questionId
        ];

        console.log(`\n🔄 MIXED SCENARIO TEST: ${questions.length} questions`);
        console.log('- 2 direct questions (no questionId)');
        console.log('- 3 questions with questionId (2 unique IDs)');

        const startTime = performance.now();

        try {
            const result = await formService.enrichQuestions(questions);
            console.log(`Processed ${result.length} questions successfully`);
        } catch (error) {
            // Expected to fail for non-existent questions
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`findById calls: ${findByIdCallCount}`);
        console.log(`findByIds calls: ${findByIdsCallCount}`);
        console.log(`Time taken: ${duration.toFixed(2)}ms`);

        // Should still use only batch query
        expect(findByIdCallCount).toBe(0);
        expect(findByIdsCallCount).toBe(1); // Single batch query for unique questionIds
    });

    test('should handle empty questions array efficiently', async () => {
        const questions = [];

        const startTime = performance.now();
        const result = await formService.enrichQuestions(questions);
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`\n⚡ EMPTY ARRAY TEST: ${duration.toFixed(2)}ms`);

        expect(result).toEqual([]);
        expect(findByIdCallCount).toBe(0);
        expect(findByIdsCallCount).toBe(0); // No queries needed
        expect(duration).toBeLessThan(1); // Should be nearly instantaneous
    });

    test('should handle questions without questionId efficiently', async () => {
        const questions = Array(10).fill(0).map((_, i) => ({
            questionText: `Direct question ${i}`,
            questionType: 'text',
        }));

        const startTime = performance.now();
        const result = await formService.enrichQuestions(questions);
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`\n⚡ NO ENRICHMENT TEST: ${questions.length} questions, ${duration.toFixed(2)}ms`);

        expect(result).toHaveLength(questions.length);
        expect(findByIdCallCount).toBe(0);
        expect(findByIdsCallCount).toBe(0); // No queries needed
        expect(duration).toBeLessThan(5); // Should be very fast
    });
});