import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import { Form } from '../../src/models/Form.js';
import { Question } from '../../src/models/Question.js';
import { Submission } from '../../src/models/Submission.js';

describe('Phase 3.1: Enhanced Batch Operations', () => {
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

    describe('Form Batch Operations', () => {
        test('should create multiple forms efficiently', async () => {
            const formsData = Array(10).fill(0).map((_, i) => ({
                title: `Batch Form ${i}`,
                description: `Batch created form ${i}`,
                questions: [
                    {
                        questionText: `Question ${i}`,
                        questionType: 'text',
                        required: false
                    }
                ],
                metadata: { batch: true, index: i }
            }));

            const startTime = performance.now();
            const forms = await Form.createMany(formsData);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(forms).toHaveLength(10);
            forms.forEach((form, i) => {
                expect(form.title).toBe(`Batch Form ${i}`);
                expect(form.metadata.batch).toBe(true);
                expect(form.metadata.index).toBe(i);
            });

            // Should be faster than individual creates
            expect(duration).toBeLessThan(200); // Less than 200ms for 10 forms

            console.log(`Batch form creation: 10 forms in ${duration.toFixed(2)}ms`);
        });

        test('should handle large batch form creation', async () => {
            const formsData = Array(50).fill(0).map((_, i) => ({
                title: `Large Batch Form ${i}`,
                description: `Large batch test ${i}`,
                questions: [
                    {
                        questionText: `Question ${i}`,
                        questionType: 'text'
                    }
                ],
                metadata: { largeBatch: true }
            }));

            const startTime = performance.now();
            const forms = await Form.createMany(formsData);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(forms).toHaveLength(50);
            expect(duration).toBeLessThan(1000); // Less than 1 second for 50 forms

            console.log(`Large batch form creation: 50 forms in ${duration.toFixed(2)}ms (avg: ${(duration / 50).toFixed(2)}ms per form)`);
        });
    });

    describe('Question Batch Operations', () => {
        test('should create multiple questions efficiently', async () => {
            const questionsData = Array(20).fill(0).map((_, i) => ({
                questionText: `Batch Question ${i}`,
                questionType: i % 2 === 0 ? 'text' : 'select',
                options: i % 2 === 0 ? null : [
                    { key: 'option1', label: 'Option 1' },
                    { key: 'option2', label: 'Option 2' }
                ],
                metadata: { batch: true, index: i }
            }));

            const startTime = performance.now();
            const questions = await Question.createMany(questionsData);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(questions).toHaveLength(20);
            questions.forEach((question, i) => {
                expect(question.questionText).toBe(`Batch Question ${i}`);
                expect(question.metadata.batch).toBe(true);
            });

            expect(duration).toBeLessThan(300); // Less than 300ms for 20 questions

            console.log(`Batch question creation: 20 questions in ${duration.toFixed(2)}ms`);
        });

        test('should delete multiple questions efficiently', async () => {
            // First create some questions
            const questionsData = Array(15).fill(0).map((_, i) => ({
                questionText: `Delete Test Question ${i}`,
                questionType: 'text',
                metadata: { deleteTest: true }
            }));

            const createdQuestions = await Question.createMany(questionsData);
            const questionIds = createdQuestions.map(q => q.id);

            const startTime = performance.now();
            const deletedQuestions = await Question.deleteMany(questionIds);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(deletedQuestions).toHaveLength(15);
            expect(duration).toBeLessThan(100); // Less than 100ms for 15 deletions

            console.log(`Batch question deletion: 15 questions in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Submission Batch Operations', () => {
        test('should create multiple submissions efficiently', async () => {
            // First create a form
            const form = await Form.create({
                title: 'Batch Submission Test Form',
                description: 'For testing batch submissions',
                questions: [
                    {
                        questionText: 'Test Question',
                        questionType: 'text',
                        required: false
                    }
                ],
                metadata: {}
            });

            const submissionsData = Array(25).fill(0).map((_, i) => ({
                formId: form.id,
                submissionData: {
                    [form.questions[0].id || 'test']: `Answer ${i}`
                },
                metadata: { batch: true, index: i }
            }));

            const startTime = performance.now();
            const submissions = await Submission.createMany(submissionsData);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(submissions).toHaveLength(25);
            submissions.forEach((submission, i) => {
                expect(submission.formId).toBe(form.id);
                expect(submission.metadata.batch).toBe(true);
            });

            expect(duration).toBeLessThan(400); // Less than 400ms for 25 submissions

            console.log(`Batch submission creation: 25 submissions in ${duration.toFixed(2)}ms`);
        });

        test('should delete submissions by form efficiently', async () => {
            // Create a form and submissions
            const form = await Form.create({
                title: 'Delete Test Form',
                description: 'For testing bulk deletion',
                questions: [
                    {
                        questionText: 'Delete Test Question',
                        questionType: 'text'
                    }
                ],
                metadata: {}
            });

            const submissionsData = Array(20).fill(0).map((_, i) => ({
                formId: form.id,
                submissionData: {
                    [form.questions[0].id || 'test']: `Delete Answer ${i}`
                },
                metadata: { deleteTest: true }
            }));

            await Submission.createMany(submissionsData);

            const startTime = performance.now();
            const deletedSubmissions = await Submission.deleteByFormId(form.id);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(deletedSubmissions).toHaveLength(20);
            expect(duration).toBeLessThan(150); // Less than 150ms for bulk deletion

            console.log(`Bulk submission deletion: 20 submissions in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Performance Comparison', () => {
        test('should show significant improvement over individual operations', async () => {
            const testData = Array(10).fill(0).map((_, i) => ({
                title: `Performance Test Form ${i}`,
                description: `Performance comparison ${i}`,
                questions: [
                    {
                        questionText: `Performance Question ${i}`,
                        questionType: 'text'
                    }
                ],
                metadata: { performanceTest: true }
            }));

            // Test individual creation
            const individualStart = performance.now();
            const individualForms = [];
            for (const formData of testData) {
                const form = await Form.create(formData);
                individualForms.push(form);
            }
            const individualEnd = performance.now();
            const individualDuration = individualEnd - individualStart;

            // Test batch creation
            const batchStart = performance.now();
            const batchForms = await Form.createMany(testData);
            const batchEnd = performance.now();
            const batchDuration = batchEnd - batchStart;

            expect(individualForms).toHaveLength(10);
            expect(batchForms).toHaveLength(10);

            // Batch should be significantly faster
            const improvement = ((individualDuration - batchDuration) / individualDuration) * 100;
            expect(improvement).toBeGreaterThan(30); // At least 30% improvement

            console.log(`Performance comparison:`);
            console.log(`  Individual: ${individualDuration.toFixed(2)}ms`);
            console.log(`  Batch: ${batchDuration.toFixed(2)}ms`);
            console.log(`  Improvement: ${improvement.toFixed(1)}%`);
        });
    });

    describe('Error Handling', () => {
        test('should handle batch operation errors gracefully', async () => {
            const invalidFormsData = [
                {
                    title: 'Valid Form',
                    description: 'This should work',
                    questions: [{ questionText: 'Valid Question', questionType: 'text' }],
                    metadata: {}
                },
                {
                    title: null, // This should cause an error
                    description: 'Invalid form',
                    questions: [],
                    metadata: {}
                }
            ];

            await expect(Form.createMany(invalidFormsData)).rejects.toThrow();
        });

        test('should handle empty batch operations', async () => {
            const emptyResult = await Form.createMany([]);
            expect(emptyResult).toEqual([]);

            const nullResult = await Question.deleteMany([]);
            expect(nullResult).toEqual([]);
        });
    });
});