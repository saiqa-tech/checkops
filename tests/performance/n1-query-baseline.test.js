/**
 * N+1 Query Performance Baseline Test
 * 
 * This test establishes a baseline for the N+1 query problem in enrichQuestions
 * before implementing the optimization.
 */

import { jest } from '@jest/globals';
import { FormService } from '../../src/services/FormService.js';
import { Question } from '../../src/models/Question.js';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';

describe('N+1 Query Baseline Performance', () => {
    let formService;
    let originalFindById;
    let queryCount = 0;

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

        // Mock Question.findById to count queries
        originalFindById = Question.findById;
        Question.findById = jest.fn().mockImplementation(async (id) => {
            queryCount++;
            return originalFindById.call(Question, id);
        });
    });

    afterAll(async () => {
        // Restore original method
        Question.findById = originalFindById;
        await closeDatabase();
    });

    beforeEach(() => {
        queryCount = 0;
        Question.findById.mockClear();
    });

    test('should demonstrate N+1 query problem with current implementation', async () => {
        // Create test questions with questionId references
        const questions = Array(10).fill(0).map((_, i) => ({
            questionId: `test-question-${i}`,
            questionText: `Override text ${i}`,
            required: true,
        }));

        console.log(`\n📊 BASELINE TEST: Enriching ${questions.length} questions`);
        console.log('Expected queries with N+1 problem:', questions.length);

        const startTime = performance.now();

        try {
            await formService.enrichQuestions(questions);
        } catch (error) {
            // Expected to fail since test questions don't exist
            // We're only measuring query count
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`Actual database queries made: ${queryCount}`);
        console.log(`Time taken: ${duration.toFixed(2)}ms`);
        console.log(`Average time per query: ${(duration / queryCount).toFixed(2)}ms`);

        // Verify N+1 problem exists
        expect(queryCount).toBe(questions.length); // Should be 10 individual queries

        // Document baseline performance
        console.log('\n🎯 BASELINE METRICS:');
        console.log(`- Questions processed: ${questions.length}`);
        console.log(`- Database queries: ${queryCount}`);
        console.log(`- Query ratio: ${queryCount / questions.length}:1 (N+1 problem confirmed)`);
        console.log(`- Total time: ${duration.toFixed(2)}ms`);
    });

    test('should show linear scaling of N+1 problem', async () => {
        const testSizes = [5, 10, 20, 50];
        const results = [];

        for (const size of testSizes) {
            queryCount = 0;
            Question.findById.mockClear();

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
                queryCount,
                duration: duration.toFixed(2),
                avgTimePerQuery: (duration / queryCount).toFixed(2),
            });

            // Verify linear scaling (N+1 problem)
            expect(queryCount).toBe(size);
        }

        console.log('\n📈 SCALING ANALYSIS:');
        console.log('Questions | Queries | Time(ms) | Avg/Query(ms)');
        console.log('----------|---------|----------|-------------');
        results.forEach(r => {
            console.log(`${r.questionCount.toString().padStart(9)} | ${r.queryCount.toString().padStart(7)} | ${r.duration.padStart(8)} | ${r.avgTimePerQuery.padStart(11)}`);
        });

        // Verify linear relationship (N+1 problem)
        results.forEach(result => {
            expect(result.queryCount).toBe(result.questionCount);
        });
    });
});