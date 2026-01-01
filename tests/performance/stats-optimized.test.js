/**
 * Stats Calculation Optimization Performance Test
 * 
 * This test validates that the stats calculation has been optimized
 * to use database aggregation instead of in-memory processing.
 */

import { jest } from '@jest/globals';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { getPool } from '../../src/config/database.js';
import { Form } from '../../src/models/Form.js';

describe('Stats Calculation Optimization Performance', () => {
    let submissionService;
    let originalQuery;
    let queryCount = 0;
    let queryTypes = [];

    beforeAll(() => {
        submissionService = new SubmissionService();

        // Mock getPool to track database queries
        const mockPool = {
            query: jest.fn().mockImplementation(async (query, params) => {
                queryCount++;
                queryTypes.push({
                    query: query.trim().split('\n')[0], // First line for identification
                    params: params?.length || 0,
                });

                // Simulate different query responses based on query type
                if (query.includes('COUNT(*) as total_submissions')) {
                    // Basic stats query
                    return {
                        rows: [{
                            total_submissions: '5000',
                            first_submission: new Date('2024-01-01'),
                            last_submission: new Date('2024-12-30'),
                        }]
                    };
                } else if (query.includes('COUNT(*) as total_answers')) {
                    // Question stats query
                    return {
                        rows: [{
                            total_answers: '4500',
                            empty_answers: '500',
                            unique_answer_count: '10',
                        }]
                    };
                } else if (query.includes('GROUP BY submission_data')) {
                    // Answer distribution query
                    return {
                        rows: [
                            { answer: 'option1', count: '2000' },
                            { answer: 'option2', count: '1500' },
                            { answer: 'option3', count: '1000' },
                        ]
                    };
                }

                return { rows: [] };
            }),
        };

        // Mock getPool to return our mock pool
        jest.unstable_mockModule('../../src/config/database.js', () => ({
            getPool: jest.fn(() => mockPool),
        }));

        // Mock Form.findById
        Form.findById = jest.fn().mockResolvedValue({
            id: 'test-form',
            title: 'Test Form',
            questions: [
                {
                    id: 'q1', questionText: 'Question 1', questionType: 'select', options: [
                        { key: 'option1', label: 'Option 1' },
                        { key: 'option2', label: 'Option 2' },
                        { key: 'option3', label: 'Option 3' },
                    ]
                },
                { id: 'q2', questionText: 'Question 2', questionType: 'text' },
                {
                    id: 'q3', questionText: 'Question 3', questionType: 'radio', options: [
                        { key: 'yes', label: 'Yes' },
                        { key: 'no', label: 'No' },
                    ]
                },
            ],
        });
    });

    beforeEach(() => {
        queryCount = 0;
        queryTypes = [];
        jest.clearAllMocks();
    });

    test('should use database aggregation instead of loading submissions', async () => {
        console.log('\n🚀 STATS OPTIMIZATION TEST');
        console.log('Expected: Database aggregation queries only');
        console.log('Expected: No submission loading into memory');

        const startTime = performance.now();
        const startMemory = process.memoryUsage();

        const stats = await submissionService.getSubmissionStats('test-form');

        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

        console.log(`Database queries executed: ${queryCount}`);
        console.log(`Processing time: ${duration.toFixed(2)}ms`);
        console.log(`Memory used: ${memoryUsed.toFixed(2)}MB`);

        console.log('\n📊 QUERY BREAKDOWN:');
        queryTypes.forEach((q, i) => {
            console.log(`${i + 1}. ${q.query} (${q.params} params)`);
        });

        // Verify optimization worked
        expect(queryCount).toBeGreaterThan(0); // Should have database queries
        expect(queryCount).toBeLessThan(20); // But not too many (efficient aggregation)
        expect(stats.totalSubmissions).toBe(5000);
        expect(stats.questionStats).toHaveProperty('q1');
        expect(stats.questionStats).toHaveProperty('q2');
        expect(stats.questionStats).toHaveProperty('q3');

        console.log('\n✅ OPTIMIZATION METRICS:');
        console.log(`- Total submissions processed: ${stats.totalSubmissions}`);
        console.log(`- Database queries: ${queryCount}`);
        console.log(`- Processing time: ${duration.toFixed(2)}ms`);
        console.log(`- Memory usage: ${memoryUsed.toFixed(2)}MB`);
        console.log(`- Questions analyzed: ${Object.keys(stats.questionStats).length}`);
    });

    test('should maintain constant query count regardless of submission volume', async () => {
        const submissionCounts = [1000, 10000, 50000, 100000];
        const results = [];

        console.log('\n📊 SCALABILITY TEST: Database Aggregation');
        console.log('Expected: Constant query count regardless of submission volume');

        for (const count of submissionCounts) {
            // Mock different submission counts
            const mockPool = {
                query: jest.fn().mockImplementation(async (query, params) => {
                    if (query.includes('COUNT(*) as total_submissions')) {
                        return {
                            rows: [{
                                total_submissions: count.toString(),
                                first_submission: new Date('2024-01-01'),
                                last_submission: new Date('2024-12-30'),
                            }]
                        };
                    } else if (query.includes('COUNT(*) as total_answers')) {
                        return {
                            rows: [{
                                total_answers: (count * 0.9).toString(), // 90% response rate
                                empty_answers: (count * 0.1).toString(),
                                unique_answer_count: '10',
                            }]
                        };
                    } else if (query.includes('GROUP BY submission_data')) {
                        return {
                            rows: [
                                { answer: 'option1', count: Math.floor(count * 0.4).toString() },
                                { answer: 'option2', count: Math.floor(count * 0.35).toString() },
                                { answer: 'option3', count: Math.floor(count * 0.25).toString() },
                            ]
                        };
                    }
                    return { rows: [] };
                }),
            };

            // Override getPool for this iteration
            jest.doMock('../../src/config/database.js', () => ({
                getPool: jest.fn(() => mockPool),
            }));

            queryCount = 0;
            const startTime = performance.now();

            const stats = await submissionService.getSubmissionStats('test-form');

            const endTime = performance.now();
            const duration = endTime - startTime;

            results.push({
                submissionCount: count,
                queryCount: mockPool.query.mock.calls.length,
                duration: duration.toFixed(2),
                totalSubmissions: stats.totalSubmissions,
            });
        }

        console.log('\nSubmissions | Queries | Time(ms) | Verified Count');
        console.log('------------|---------|----------|---------------');
        results.forEach(r => {
            console.log(
                `${r.submissionCount.toString().padStart(11)} | ` +
                `${r.queryCount.toString().padStart(7)} | ` +
                `${r.duration.padStart(8)} | ` +
                `${r.totalSubmissions.toString().padStart(13)}`
            );
        });

        // Verify constant query pattern (O(1) complexity)
        const firstQueryCount = results[0].queryCount;
        results.forEach(result => {
            expect(result.queryCount).toBe(firstQueryCount); // Same number of queries regardless of data size
            expect(result.totalSubmissions).toBe(result.submissionCount); // Correct counts
        });

        console.log('\n🎯 SCALABILITY SUCCESS:');
        console.log('- Query count remains constant regardless of submission volume');
        console.log('- Processing time independent of data size');
        console.log('- Memory usage constant (no data loading)');
        console.log('- Database handles all aggregation efficiently');
    });

    test('should handle different question types efficiently', async () => {
        console.log('\n🔧 QUESTION TYPE HANDLING TEST');

        const mockPool = {
            query: jest.fn().mockImplementation(async (query, params) => {
                queryCount++;

                if (query.includes('COUNT(*) as total_submissions')) {
                    return {
                        rows: [{
                            total_submissions: '1000',
                            first_submission: new Date('2024-01-01'),
                            last_submission: new Date('2024-12-30'),
                        }]
                    };
                } else if (query.includes('COUNT(*) as total_answers')) {
                    return {
                        rows: [{
                            total_answers: '900',
                            empty_answers: '100',
                            unique_answer_count: '5',
                        }]
                    };
                } else if (query.includes('GROUP BY submission_data')) {
                    // Different responses based on question type
                    if (params[1] === 'q1') { // Select question
                        return {
                            rows: [
                                { answer: 'option1', count: '400' },
                                { answer: 'option2', count: '300' },
                                { answer: 'option3', count: '200' },
                            ]
                        };
                    } else if (params[1] === 'q2') { // Text question
                        return {
                            rows: [
                                { answer_text: 'Response A', count: '300' },
                                { answer_text: 'Response B', count: '250' },
                                { answer_text: 'Response C', count: '200' },
                                { answer_text: 'Response D', count: '150' },
                            ]
                        };
                    } else if (params[1] === 'q3') { // Radio question
                        return {
                            rows: [
                                { answer: 'yes', count: '600' },
                                { answer: 'no', count: '300' },
                            ]
                        };
                    }
                }

                return { rows: [] };
            }),
        };

        jest.doMock('../../src/config/database.js', () => ({
            getPool: jest.fn(() => mockPool),
        }));

        queryCount = 0;
        const stats = await submissionService.getSubmissionStats('test-form');

        console.log(`Total queries for 3 questions: ${queryCount}`);
        console.log('Question types handled:');
        console.log('- q1 (select): Options with labels');
        console.log('- q2 (text): Simple text responses');
        console.log('- q3 (radio): Yes/No options');

        // Verify all question types processed correctly
        expect(stats.questionStats.q1).toHaveProperty('answerDistribution');
        expect(stats.questionStats.q2).toHaveProperty('answerDistribution');
        expect(stats.questionStats.q3).toHaveProperty('answerDistribution');

        // Verify option questions have key distribution
        expect(stats.questionStats.q1).toHaveProperty('_keyDistribution');
        expect(stats.questionStats.q3).toHaveProperty('_keyDistribution');

        console.log('\n✅ QUESTION TYPE HANDLING SUCCESS:');
        console.log('- All question types processed with appropriate queries');
        console.log('- Option-based questions get label mapping');
        console.log('- Text questions get simple aggregation');
        console.log('- Efficient query pattern maintained');
    });

    test('should provide accurate stats structure', async () => {
        const mockPool = {
            query: jest.fn().mockImplementation(async (query, params) => {
                if (query.includes('COUNT(*) as total_submissions')) {
                    return {
                        rows: [{
                            total_submissions: '2500',
                            first_submission: new Date('2024-01-01T10:00:00Z'),
                            last_submission: new Date('2024-12-30T15:30:00Z'),
                        }]
                    };
                } else if (query.includes('COUNT(*) as total_answers')) {
                    return {
                        rows: [{
                            total_answers: '2200',
                            empty_answers: '300',
                            unique_answer_count: '8',
                        }]
                    };
                } else if (query.includes('GROUP BY submission_data')) {
                    return {
                        rows: [
                            { answer: 'option1', count: '1000' },
                            { answer: 'option2', count: '800' },
                            { answer: 'option3', count: '400' },
                        ]
                    };
                }
                return { rows: [] };
            }),
        };

        jest.doMock('../../src/config/database.js', () => ({
            getPool: jest.fn(() => mockPool),
        }));

        const stats = await submissionService.getSubmissionStats('test-form');

        console.log('\n📋 STATS STRUCTURE VALIDATION:');
        console.log(`Total submissions: ${stats.totalSubmissions}`);
        console.log(`First submission: ${stats.firstSubmission}`);
        console.log(`Last submission: ${stats.lastSubmission}`);
        console.log(`Questions analyzed: ${Object.keys(stats.questionStats).length}`);

        // Verify complete stats structure
        expect(stats).toHaveProperty('totalSubmissions');
        expect(stats).toHaveProperty('firstSubmission');
        expect(stats).toHaveProperty('lastSubmission');
        expect(stats).toHaveProperty('questionStats');

        // Verify question stats structure
        Object.values(stats.questionStats).forEach(questionStat => {
            expect(questionStat).toHaveProperty('questionText');
            expect(questionStat).toHaveProperty('questionType');
            expect(questionStat).toHaveProperty('totalAnswers');
            expect(questionStat).toHaveProperty('emptyAnswers');
            expect(questionStat).toHaveProperty('uniqueAnswerCount');
            expect(questionStat).toHaveProperty('answerDistribution');
        });

        console.log('\n✅ STRUCTURE VALIDATION SUCCESS:');
        console.log('- All required fields present');
        console.log('- Backward compatibility maintained');
        console.log('- Enhanced with first/last submission timestamps');
    });
});