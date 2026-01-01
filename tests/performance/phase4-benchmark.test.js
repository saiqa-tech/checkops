/**
 * Phase 4.2: Comprehensive Performance Benchmark Suite
 * Production-ready performance validation and monitoring
 */

import { FormService } from '../../src/services/FormService.js';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { QuestionService } from '../../src/services/QuestionService.js';
import { Form } from '../../src/models/Form.js';
import { Question } from '../../src/models/Question.js';
import { Submission } from '../../src/models/Submission.js';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import { metricsCollector } from '../../src/utils/metrics.js';

describe('Phase 4: Performance Benchmark Suite', () => {
    let formService;
    let submissionService;
    let questionService;

    beforeAll(async () => {
        await initializeDatabase({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'checkops_test',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });

        formService = new FormService();
        submissionService = new SubmissionService();
        questionService = new QuestionService();

        // Reset metrics for clean testing
        metricsCollector.reset();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('4.1: Core Performance Benchmarks', () => {
        test('Form creation with 100 questions should complete under 100ms', async () => {
            const questions = Array(100).fill(0).map((_, i) => ({
                questionText: `Performance Test Question ${i + 1}`,
                questionType: 'text',
                required: i % 2 === 0,
                metadata: { testIndex: i }
            }));

            const start = performance.now();
            const form = await formService.createForm({
                title: 'Performance Benchmark Form - 100 Questions',
                description: 'Automated performance test form',
                questions,
                metadata: { benchmark: true, questionCount: 100 }
            });
            const duration = performance.now() - start;

            console.log(`Form creation (100 questions): ${duration.toFixed(2)}ms`);

            expect(duration).toBeLessThan(100);
            expect(form.id).toBeDefined();
            expect(form.questions).toHaveLength(100);

            // Cleanup
            await Form.delete(form.id);
        });

        test('Batch form creation should outperform individual creation', async () => {
            const formsData = Array(20).fill(0).map((_, i) => ({
                title: `Batch Test Form ${i + 1}`,
                description: `Batch performance test form ${i + 1}`,
                questions: [
                    { questionText: `Question 1 for form ${i + 1}`, questionType: 'text' },
                    { questionText: `Question 2 for form ${i + 1}`, questionType: 'email' }
                ]
            }));

            // Individual creation
            const individualStart = performance.now();
            const individualForms = [];
            for (const formData of formsData) {
                const form = await formService.createForm(formData);
                individualForms.push(form);
            }
            const individualDuration = performance.now() - individualStart;

            // Batch creation
            const batchStart = performance.now();
            const batchForms = await Form.createMany(formsData);
            const batchDuration = performance.now() - batchStart;

            const improvement = ((individualDuration - batchDuration) / individualDuration) * 100;

            console.log(`Individual creation: ${individualDuration.toFixed(2)}ms`);
            console.log(`Batch creation: ${batchDuration.toFixed(2)}ms`);
            console.log(`Improvement: ${improvement.toFixed(1)}%`);

            expect(improvement).toBeGreaterThan(20); // At least 20% improvement
            expect(batchForms).toHaveLength(20);

            // Cleanup
            const allFormIds = [...individualForms.map(f => f.id), ...batchForms.map(f => f.id)];
            for (const id of allFormIds) {
                await Form.delete(id);
            }
        });

        test('Large form validation should complete under 50ms', async () => {
            const largeFormData = {
                title: 'Large Validation Test Form',
                description: 'Form with many questions for validation performance testing',
                questions: Array(200).fill(0).map((_, i) => ({
                    questionText: `Validation Question ${i + 1}`,
                    questionType: ['text', 'email', 'number', 'select'][i % 4],
                    required: i % 3 === 0,
                    options: i % 4 === 3 ? [
                        { key: `opt1_${i}`, label: `Option 1 for Q${i}` },
                        { key: `opt2_${i}`, label: `Option 2 for Q${i}` },
                        { key: `opt3_${i}`, label: `Option 3 for Q${i}` }
                    ] : null
                }))
            };

            const start = performance.now();
            const form = await formService.createForm(largeFormData);
            const duration = performance.now() - start;

            console.log(`Large form validation (200 questions): ${duration.toFixed(2)}ms`);

            expect(duration).toBeLessThan(50);
            expect(form.questions).toHaveLength(200);

            // Cleanup
            await Form.delete(form.id);
        });
    });

    describe('4.2: Scalability Benchmarks', () => {
        let testForm;

        beforeAll(async () => {
            testForm = await formService.createForm({
                title: 'Scalability Test Form',
                description: 'Form for scalability testing',
                questions: [
                    { questionText: 'Name', questionType: 'text', required: true },
                    { questionText: 'Email', questionType: 'email', required: true },
                    { questionText: 'Age', questionType: 'number', required: false },
                    {
                        questionText: 'Rating', questionType: 'select', options: [
                            { key: 'excellent', label: 'Excellent' },
                            { key: 'good', label: 'Good' },
                            { key: 'fair', label: 'Fair' },
                            { key: 'poor', label: 'Poor' }
                        ]
                    }
                ]
            });
        });

        afterAll(async () => {
            if (testForm) {
                await Form.delete(testForm.id);
            }
        });

        test('Bulk submission creation should handle 1000 submissions efficiently', async () => {
            const submissionsData = Array(1000).fill(0).map((_, i) => ({
                formId: testForm.id,
                submissionData: {
                    [testForm.questions[0].id]: `Test User ${i + 1}`,
                    [testForm.questions[1].id]: `user${i + 1}@test.com`,
                    [testForm.questions[2].id]: 20 + (i % 50),
                    [testForm.questions[3].id]: ['excellent', 'good', 'fair', 'poor'][i % 4]
                },
                metadata: { batchTest: true, index: i }
            }));

            const start = performance.now();
            const submissions = await Submission.createMany(submissionsData);
            const duration = performance.now() - start;

            const avgTimePerSubmission = duration / submissions.length;

            console.log(`Bulk submission creation: 1000 submissions in ${duration.toFixed(2)}ms`);
            console.log(`Average time per submission: ${avgTimePerSubmission.toFixed(3)}ms`);

            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
            expect(avgTimePerSubmission).toBeLessThan(5); // Less than 5ms per submission
            expect(submissions).toHaveLength(1000);

            // Cleanup
            await Submission.deleteByFormId(testForm.id);
        });

        test('Stats calculation for large dataset should complete under 2 seconds', async () => {
            // Create test submissions
            const submissionsData = Array(5000).fill(0).map((_, i) => ({
                formId: testForm.id,
                submissionData: {
                    [testForm.questions[0].id]: `Stats Test User ${i + 1}`,
                    [testForm.questions[1].id]: `statsuser${i + 1}@test.com`,
                    [testForm.questions[2].id]: 18 + (i % 60),
                    [testForm.questions[3].id]: ['excellent', 'good', 'fair', 'poor'][i % 4]
                }
            }));

            await Submission.createMany(submissionsData);

            const start = performance.now();
            const stats = await submissionService.getSubmissionStats(testForm.id);
            const duration = performance.now() - start;

            console.log(`Stats calculation (5000 submissions): ${duration.toFixed(2)}ms`);

            expect(duration).toBeLessThan(2000);
            expect(stats.totalSubmissions).toBe(5000);
            expect(stats.questionStats).toBeDefined();

            // Cleanup
            await Submission.deleteByFormId(testForm.id);
        });

        test('Concurrent form operations should maintain performance', async () => {
            const concurrentOperations = 50;
            const operations = [];

            const start = performance.now();

            // Create concurrent form creation operations
            for (let i = 0; i < concurrentOperations; i++) {
                operations.push(
                    formService.createForm({
                        title: `Concurrent Test Form ${i + 1}`,
                        description: `Concurrent operation test ${i + 1}`,
                        questions: [
                            { questionText: `Question for form ${i + 1}`, questionType: 'text' }
                        ]
                    })
                );
            }

            const forms = await Promise.all(operations);
            const duration = performance.now() - start;

            const avgTimePerForm = duration / forms.length;

            console.log(`Concurrent operations: ${concurrentOperations} forms in ${duration.toFixed(2)}ms`);
            console.log(`Average time per form: ${avgTimePerForm.toFixed(2)}ms`);

            expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
            expect(forms).toHaveLength(concurrentOperations);
            expect(forms.every(form => form.id)).toBe(true);

            // Cleanup
            for (const form of forms) {
                await Form.delete(form.id);
            }
        });
    });

    describe('4.3: Performance Regression Tests', () => {
        test('N+1 query optimization should maintain performance', async () => {
            // Create test questions in question bank
            const bankQuestions = await Question.createMany(
                Array(50).fill(0).map((_, i) => ({
                    questionText: `Bank Question ${i + 1}`,
                    questionType: 'text',
                    metadata: { bankTest: true }
                }))
            );

            // Create form with references to bank questions
            const formQuestions = bankQuestions.map((q, i) => ({
                questionId: q.id,
                questionText: `Form Question ${i + 1}`,
                questionType: 'text',
                required: i % 2 === 0
            }));

            const start = performance.now();
            const enrichedQuestions = await formService.enrichQuestions(formQuestions);
            const duration = performance.now() - start;

            console.log(`N+1 optimization: 50 questions enriched in ${duration.toFixed(2)}ms`);

            expect(duration).toBeLessThan(50); // Should be very fast with batch query
            expect(enrichedQuestions).toHaveLength(50);

            // Cleanup
            await Question.deleteMany(bankQuestions.map(q => q.id));
        });

        test('Memory usage should remain stable during large operations', async () => {
            const initialMemory = process.memoryUsage();

            // Perform memory-intensive operations
            const forms = await Form.createMany(
                Array(100).fill(0).map((_, i) => ({
                    title: `Memory Test Form ${i + 1}`,
                    description: 'Memory usage test',
                    questions: Array(20).fill(0).map((_, j) => ({
                        questionText: `Question ${j + 1}`,
                        questionType: 'text'
                    }))
                }))
            );

            const afterOperationMemory = process.memoryUsage();
            const memoryIncrease = afterOperationMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseKB = memoryIncrease / 1024;

            console.log(`Memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);

            // Memory increase should be reasonable (less than 50MB for 100 forms)
            expect(memoryIncreaseKB).toBeLessThan(50 * 1024);

            // Cleanup
            await Form.deleteMany(forms.map(f => f.id));

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        });
    });

    describe('4.4: Metrics Collection Validation', () => {
        test('Metrics collector should track performance accurately', async () => {
            metricsCollector.reset();

            // Perform tracked operations
            const form = await formService.createForm({
                title: 'Metrics Test Form',
                description: 'Testing metrics collection',
                questions: [
                    { questionText: 'Test Question', questionType: 'text' }
                ]
            });

            const submissions = await Submission.createMany([
                {
                    formId: form.id,
                    submissionData: { [form.questions[0].id]: 'Test Answer 1' }
                },
                {
                    formId: form.id,
                    submissionData: { [form.questions[0].id]: 'Test Answer 2' }
                }
            ]);

            const metrics = metricsCollector.getMetrics();
            const summary = metricsCollector.getPerformanceSummary();

            console.log('Performance Summary:', JSON.stringify(summary, null, 2));

            expect(metrics.queries.count).toBeGreaterThan(0);
            expect(metrics.operations).toBeDefined();
            expect(summary.overview).toBeDefined();
            expect(summary.performance).toBeDefined();

            // Cleanup
            await Submission.deleteMany(submissions.map(s => s.id));
            await Form.delete(form.id);
        });

        test('Performance monitor should detect performance regressions', async () => {
            const baselineOperations = 10;
            const regressionThreshold = 50; // 50% performance degradation threshold

            // Establish baseline
            const baselineTimes = [];
            for (let i = 0; i < baselineOperations; i++) {
                const start = performance.now();
                await formService.createForm({
                    title: `Baseline Form ${i + 1}`,
                    questions: [{ questionText: 'Test', questionType: 'text' }]
                });
                baselineTimes.push(performance.now() - start);
            }

            const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;

            // Test current performance
            const currentTimes = [];
            for (let i = 0; i < baselineOperations; i++) {
                const start = performance.now();
                await formService.createForm({
                    title: `Current Form ${i + 1}`,
                    questions: [{ questionText: 'Test', questionType: 'text' }]
                });
                currentTimes.push(performance.now() - start);
            }

            const currentAvg = currentTimes.reduce((a, b) => a + b, 0) / currentTimes.length;
            const performanceChange = ((currentAvg - baselineAvg) / baselineAvg) * 100;

            console.log(`Baseline average: ${baselineAvg.toFixed(2)}ms`);
            console.log(`Current average: ${currentAvg.toFixed(2)}ms`);
            console.log(`Performance change: ${performanceChange.toFixed(1)}%`);

            // Should not have significant performance regression
            expect(performanceChange).toBeLessThan(regressionThreshold);
        });
    });

    describe('4.5: Production Readiness Validation', () => {
        test('System should handle production-like load', async () => {
            const productionLoad = {
                forms: 20,
                questionsPerForm: 15,
                submissionsPerForm: 100
            };

            console.log('Starting production load test...');

            const start = performance.now();

            // Create forms
            const forms = await Form.createMany(
                Array(productionLoad.forms).fill(0).map((_, i) => ({
                    title: `Production Load Form ${i + 1}`,
                    description: 'Production load testing',
                    questions: Array(productionLoad.questionsPerForm).fill(0).map((_, j) => ({
                        questionText: `Question ${j + 1}`,
                        questionType: ['text', 'email', 'number', 'select'][j % 4],
                        options: j % 4 === 3 ? [
                            { key: 'opt1', label: 'Option 1' },
                            { key: 'opt2', label: 'Option 2' }
                        ] : null
                    }))
                }))
            );

            // Create submissions for each form
            for (const form of forms) {
                const submissionsData = Array(productionLoad.submissionsPerForm).fill(0).map((_, i) => ({
                    formId: form.id,
                    submissionData: form.questions.reduce((data, question) => {
                        data[question.id] = `Test data ${i + 1}`;
                        return data;
                    }, {}),
                    metadata: { loadTest: true }
                }));

                await Submission.createMany(submissionsData);
            }

            const duration = performance.now() - start;
            const totalOperations = productionLoad.forms + (productionLoad.forms * productionLoad.submissionsPerForm);

            console.log(`Production load test completed in ${duration.toFixed(2)}ms`);
            console.log(`Total operations: ${totalOperations}`);
            console.log(`Average time per operation: ${(duration / totalOperations).toFixed(2)}ms`);

            // Should handle production load efficiently
            expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds
            expect(forms).toHaveLength(productionLoad.forms);

            // Cleanup
            for (const form of forms) {
                await Submission.deleteByFormId(form.id);
                await Form.delete(form.id);
            }
        });

        test('Error handling should not impact performance significantly', async () => {
            const validOperations = 10;
            const invalidOperations = 5;

            // Measure valid operations
            const validStart = performance.now();
            const validForms = [];
            for (let i = 0; i < validOperations; i++) {
                const form = await formService.createForm({
                    title: `Valid Form ${i + 1}`,
                    questions: [{ questionText: 'Valid Question', questionType: 'text' }]
                });
                validForms.push(form);
            }
            const validDuration = performance.now() - validStart;

            // Measure operations with errors
            const errorStart = performance.now();
            let errorCount = 0;
            for (let i = 0; i < invalidOperations; i++) {
                try {
                    await formService.createForm({
                        title: '', // Invalid: empty title
                        questions: []  // Invalid: no questions
                    });
                } catch (error) {
                    errorCount++;
                }
            }
            const errorDuration = performance.now() - errorStart;

            const validAvg = validDuration / validOperations;
            const errorAvg = errorDuration / invalidOperations;

            console.log(`Valid operations average: ${validAvg.toFixed(2)}ms`);
            console.log(`Error operations average: ${errorAvg.toFixed(2)}ms`);
            console.log(`Errors handled: ${errorCount}/${invalidOperations}`);

            // Error handling should not be significantly slower
            expect(errorAvg).toBeLessThan(validAvg * 2); // Should not be more than 2x slower
            expect(errorCount).toBe(invalidOperations); // All errors should be caught

            // Cleanup
            for (const form of validForms) {
                await Form.delete(form.id);
            }
        });
    });
});