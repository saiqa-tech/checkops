/**
 * Stats Calculation Performance Baseline Test
 * 
 * This test establishes a baseline for the current stats calculation
 * implementation before optimization.
 */

import { jest } from '@jest/globals';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { Submission } from '../../src/models/Submission.js';
import { Form } from '../../src/models/Form.js';
import { getPool } from '../../src/config/database.js';

describe('Stats Calculation Baseline Performance', () => {
    let submissionService;
    let originalQuery;
    let submissionQueryCount = 0;
    let formQueryCount = 0;

    beforeAll(() => {
        submissionService = new SubmissionService();

        // Mock pool.query to simulate the actual database calls
        const pool = getPool();
        originalQuery = pool.query;
        pool.query = jest.fn().mockImplementation(async (query, params) => {
            if (query.includes('FROM submissions')) {
                submissionQueryCount++;
                const limit = 1000; // Simulate loading submissions

                console.log(`📊 Loading ${limit} submissions into memory...`);

                // Simulate realistic submission data for stats query
                if (query.includes('COUNT(*)')) {
                    return {
                        rows: [{
                            total_submissions: limit,
                            first_submission: new Date(),
                            last_submission: new Date()
                        }]
                    };
                }

                // Simulate submission data for aggregation
                const submissions = Array(limit).fill(0).map((_, i) => ({
                    id: `sub-${i}`,
                    form_id: params[0],
                    submission_data: {
                        'q1': `Answer ${i % 5}`, // Simulate 5 different answers
                        'q2': i % 2 === 0 ? 'yes' : 'no', // Boolean-like answers
                        'q3': `Text response ${i}`, // Unique text responses
                    },
                    submitted_at: new Date(),
                }));

                return { rows: submissions };
            }

            // Pass through other queries
            return originalQuery.call(pool, query, params);
        });

        // Mock Form.findById
        Form.findById = jest.fn().mockImplementation(async (id) => {
            formQueryCount++;
            return {
                id,
                title: 'Test Form',
                questions: [
                    {
                        id: 'q1', questionText: 'Question 1', questionType: 'select', options: [
                            { key: 'Answer 0', label: 'Answer 0' },
                            { key: 'Answer 1', label: 'Answer 1' },
                            { key: 'Answer 2', label: 'Answer 2' },
                            { key: 'Answer 3', label: 'Answer 3' },
                            { key: 'Answer 4', label: 'Answer 4' },
                        ]
                    },
                    {
                        id: 'q2', questionText: 'Question 2', questionType: 'radio', options: [
                            { key: 'yes', label: 'Yes' },
                            { key: 'no', label: 'No' },
                        ]
                    },
                    { id: 'q3', questionText: 'Question 3', questionType: 'text' },
                ],
            };
        });
    });

    afterAll(() => {
        const pool = getPool();
        pool.query = originalQuery;
    });

    beforeEach(() => {
        submissionQueryCount = 0;
        formQueryCount = 0;
        const pool = getPool();
        pool.query.mockClear();
        Form.findById.mockClear();
    });

    test.skip('should demonstrate memory-intensive stats calculation', async () => {
        const submissionCounts = [100, 500, 1000];
        const results = [];

        console.log('\n📊 BASELINE STATS CALCULATION ANALYSIS');
        console.log('=====================================');

        for (const count of submissionCounts) {
            // Configure mock to return specific number of submissions
            Submission.findByFormId.mockImplementationOnce(async (formId, options) => {
                submissionQueryCount++;
                console.log(`📊 Loading ${count} submissions into memory...`);

                // Simulate memory usage by creating realistic data
                const submissions = Array(count).fill(0).map((_, i) => ({
                    id: `sub-${i}`,
                    formId,
                    submissionData: {
                        'q1': `Answer ${i % 5}`,
                        'q2': i % 2 === 0 ? 'yes' : 'no',
                        'q3': `Text response ${i}`,
                    },
                    submittedAt: new Date(),
                }));

                return submissions;
            });

            const startTime = performance.now();
            const startMemory = process.memoryUsage();

            const stats = await submissionService.getSubmissionStats('test-form');

            const endTime = performance.now();
            const endMemory = process.memoryUsage();
            const duration = endTime - startTime;
            const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024; // MB

            results.push({
                submissionCount: count,
                duration: duration.toFixed(2),
                memoryUsed: memoryUsed.toFixed(2),
                submissionQueries: submissionQueryCount,
                formQueries: formQueryCount,
            });

            console.log(`${count} submissions: ${duration.toFixed(2)}ms, ${memoryUsed.toFixed(2)}MB memory`);

            // Verify stats structure
            expect(stats.totalSubmissions).toBe(count);
            expect(stats.questionStats).toHaveProperty('q1');
            expect(stats.questionStats).toHaveProperty('q2');
            expect(stats.questionStats).toHaveProperty('q3');

            // Reset for next iteration
            submissionQueryCount = 0;
            formQueryCount = 0;
        }

        console.log('\n📈 BASELINE PERFORMANCE ANALYSIS:');
        console.log('Submissions | Time(ms) | Memory(MB) | Sub Queries | Form Queries');
        console.log('------------|----------|------------|-------------|-------------');
        results.forEach(r => {
            console.log(
                `${r.submissionCount.toString().padStart(11)} | ` +
                `${r.duration.padStart(8)} | ` +
                `${r.memoryUsed.padStart(10)} | ` +
                `${r.submissionQueries.toString().padStart(11)} | ` +
                `${r.formQueries.toString().padStart(11)}`
            );
        });

        console.log('\n🚨 BASELINE ISSUES IDENTIFIED:');
        console.log('- All submissions loaded into memory');
        console.log('- In-memory processing with nested loops');
        console.log('- Memory usage scales linearly with submission count');
        console.log('- Processing time scales with submission count');
        console.log('- No database aggregation utilized');

        // Verify performance degrades with scale
        expect(parseFloat(results[2].duration)).toBeGreaterThan(parseFloat(results[0].duration));
        expect(parseFloat(results[2].memoryUsed)).toBeGreaterThan(parseFloat(results[0].memoryUsed));
    });

    test('should show linear scaling issues', async () => {
        const testSizes = [50, 100, 200, 500];
        const scalingResults = [];

        for (const size of testSizes) {
            Submission.findByFormId.mockImplementationOnce(async (formId, options) => {
                const submissions = Array(size).fill(0).map((_, i) => ({
                    id: `sub-${i}`,
                    formId,
                    submissionData: { 'q1': `Answer ${i % 3}` },
                    submittedAt: new Date(),
                }));
                return submissions;
            });

            const startTime = performance.now();
            await submissionService.getSubmissionStats('test-form');
            const endTime = performance.now();
            const duration = endTime - startTime;

            scalingResults.push({
                size,
                duration: duration.toFixed(2),
                timePerSubmission: (duration / size).toFixed(3),
            });
        }

        console.log('\n📊 SCALING ANALYSIS:');
        console.log('Size | Time(ms) | Time/Sub(ms)');
        console.log('-----|----------|-------------');
        scalingResults.forEach(r => {
            console.log(`${r.size.toString().padStart(4)} | ${r.duration.padStart(8)} | ${r.timePerSubmission.padStart(11)}`);
        });

        // Verify linear scaling (performance degrades with size)
        const firstTime = parseFloat(scalingResults[0].duration);
        const lastTime = parseFloat(scalingResults[scalingResults.length - 1].duration);
        expect(lastTime).toBeGreaterThan(firstTime * 5); // Should be significantly slower
    });

    test('should demonstrate memory pressure with large datasets', async () => {
        // Test with the maximum limit (10,000 submissions)
        Submission.findByFormId.mockImplementationOnce(async (formId, options) => {
            console.log('\n🔥 STRESS TEST: Loading 10,000 submissions...');
            const submissions = Array(10000).fill(0).map((_, i) => ({
                id: `sub-${i}`,
                formId,
                submissionData: {
                    'q1': `Answer ${i % 10}`,
                    'q2': `Category ${i % 5}`,
                    'q3': `Response ${i}`, // Unique responses
                },
                submittedAt: new Date(),
            }));
            return submissions;
        });

        const startTime = performance.now();
        const startMemory = process.memoryUsage();

        const stats = await submissionService.getSubmissionStats('test-form');

        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

        console.log(`\n💥 STRESS TEST RESULTS:`);
        console.log(`- Processing time: ${duration.toFixed(2)}ms`);
        console.log(`- Memory used: ${memoryUsed.toFixed(2)}MB`);
        console.log(`- Total submissions: ${stats.totalSubmissions}`);
        console.log(`- Questions processed: ${Object.keys(stats.questionStats).length}`);

        expect(stats.totalSubmissions).toBe(10000);
        expect(duration).toBeGreaterThan(100); // Should take significant time
        expect(memoryUsed).toBeGreaterThan(10); // Should use significant memory

        console.log('\n⚠️  SCALABILITY CONCERNS:');
        console.log('- High memory usage for large datasets');
        console.log('- Processing time increases with submission count');
        console.log('- No database-level aggregation');
        console.log('- Potential for out-of-memory errors');
    });
});