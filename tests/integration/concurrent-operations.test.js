import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';
import { isUUID, isSID, validateFormIds, validateQuestionIds, validateSubmissionIds } from '../helpers/validators.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

describe('Concurrent Operations: Race Conditions & High Load', () => {
    let checkops;
    let pool;

    beforeAll(async () => {
        checkops = new CheckOps({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'checkops',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        });

        try {
            await checkops.initialize();
            pool = getPool();
        } catch (error) {
            console.log('Database not available, skipping concurrent operation tests');
            checkops = null;
        }
    });

    afterAll(async () => {
        if (checkops) {
            await checkops.close();
        }
    });

    beforeEach(async () => {
        if (!checkops) {
            return;
        }

        // Use cleanup helper to delete test data
        await cleanupAllTestData(checkops);
    });

    describe('High Volume Concurrent Submissions', () => {
        test('should handle 100 concurrent submissions without data corruption', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [
                    { key: 'opt_a', label: 'Option A' },
                    { key: 'opt_b', label: 'Option B' },
                    { key: 'opt_c', label: 'Option C' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Create 100 concurrent submissions with different options (using keys)
            const submissionPromises = Array.from({ length: 100 }, (_, i) => {
                const options = ['opt_a', 'opt_b', 'opt_c'];
                const selectedOption = options[i % 3];

                return checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: selectedOption },  // Use key, not label
                });
            });

            const submissions = await Promise.all(submissionPromises);

            expect(submissions).toHaveLength(100);
            expect(submissions.every(sub => sub.id)).toBe(true);
            // Validate first submission as sample
            validateSubmissionIds(submissions[0]);

            // Verify all submissions stored correctly
            const stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(100);
            expect(stats.questionStats[question.id].totalAnswers).toBe(100);
            expect(
                stats.questionStats[question.id].answerDistribution['Option A'] +
                stats.questionStats[question.id].answerDistribution['Option B'] +
                stats.questionStats[question.id].answerDistribution['Option C']
            ).toBe(100);
        });

        test('should maintain data integrity with 500 concurrent submissions', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Rate experience',
                questionType: 'select',
                options: [
                    { key: 'rate_1', label: '1 - Poor' },
                    { key: 'rate_2', label: '2 - Fair' },
                    { key: 'rate_3', label: '3 - Good' },
                    { key: 'rate_4', label: '4 - Very Good' },
                    { key: 'rate_5', label: '5 - Excellent' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Survey Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Create 500 concurrent submissions with keys
            const submissionPromises = Array.from({ length: 500 }, (_, i) => {
                const rating = (i % 5) + 1;
                const ratingKey = `rate_${rating}`;
                return checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: ratingKey },  // Use key, not label
                });
            });

            const submissions = await Promise.all(submissionPromises);

            expect(submissions).toHaveLength(500);
            // Validate first submission as sample
            validateSubmissionIds(submissions[0]);

            // Verify stats are accurate
            const stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(500);

            // Each rating should have ~100 submissions
            Object.values(stats.questionStats[question.id].answerDistribution).forEach(count => {
                expect(count).toBeGreaterThanOrEqual(99);
                expect(count).toBeLessThanOrEqual(101);
            });
        });
    });

    describe('Concurrent Label Changes & Submissions', () => {
        test('should handle label change after multiple submissions', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select status',
                questionType: 'select',
                options: [
                    { key: 'status_active', label: 'Active' },
                    { key: 'status_inactive', label: 'Inactive' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Status Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Create multiple submissions with key (not label)
            const submission1 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'status_active' },  // Use key, not label
            });
            validateSubmissionIds(submission1);

            const submission2 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'status_active' },  // Use key, not label
            });
            // Note: Not validating submission2 for brevity

            // Change the label
            await checkops.updateOptionLabel(question.id, 'status_active', 'Live');  // Use UUID

            // Submit with key (not new label)
            const submission3 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'status_active' },  // Use key, not label
            });
            // Note: Not validating submission3 for brevity

            // Verify all submissions reference correct key
            const retrieved1 = await checkops.getSubmission(submission1.id);  // Use UUID
            const retrieved2 = await checkops.getSubmission(submission2.id);  // Use UUID
            const retrieved3 = await checkops.getSubmission(submission3.id);  // Use UUID

            expect(retrieved1._rawData[question.id]).toBe('status_active');
            expect(retrieved2._rawData[question.id]).toBe('status_active');
            expect(retrieved3._rawData[question.id]).toBe('status_active');

            // All should show the updated label
            expect(retrieved1.submissionData[question.id]).toBe('Live');
            expect(retrieved2.submissionData[question.id]).toBe('Live');
            expect(retrieved3.submissionData[question.id]).toBe('Live');

            // Stats should aggregate correctly
            const stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(3);
            expect(stats.questionStats[question.id].answerDistribution['Live']).toBe(3);
        });

        test('should handle sequential reads and label changes', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select priority',
                questionType: 'select',
                options: [{ key: 'priority_high', label: 'High' }],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Submit initial response with key
            const sub1 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(sub1);

            // Change label
            await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical');  // Use UUID

            // Read submission and submit new response with key (not new label)
            const retrieved1 = await checkops.getSubmission(sub1.id);  // Use UUID
            const newSubmission = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(newSubmission);

            // First submission should show updated label
            expect(retrieved1.submissionData[question.id]).toBe('Critical');
            expect(retrieved1._rawData[question.id]).toBe('priority_high');

            // New submission should also be correct
            const retrievedNew = await checkops.getSubmission(newSubmission.id);  // Use UUID
            expect(retrievedNew.submissionData[question.id]).toBe('Critical');
            expect(retrievedNew._rawData[question.id]).toBe('priority_high');
        });
    });

    describe('Connection Pool & Resource Management', () => {
        test('should gracefully handle connection pool under high load', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Test',
                questionType: 'text',
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Create many concurrent operations
            const operations = Array.from({ length: 50 }, (_, i) =>
                checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: `Response ${i}` },  // Use UUID as key
                })
            );

            const results = await Promise.all(operations);

            expect(results).toHaveLength(50);
            expect(results.every(r => r.id)).toBe(true);
            // Validate first result as sample
            validateSubmissionIds(results[0]);

            // Verify all stored correctly
            const stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(50);
        });

        test('should maintain consistency with sequential mixed operations', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'multiselect',
                options: [
                    { key: 'opt_1', label: 'Option 1' },
                    { key: 'opt_2', label: 'Option 2' },
                    { key: 'opt_3', label: 'Option 3' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Multiselect Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Submit first batch with keys (not labels)
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: ['opt_1', 'opt_2'] },  // Use keys, not labels
                });
                // Note: Not validating each submission in loop for performance
            }

            // Change label
            await checkops.updateOptionLabel(question.id, 'opt_1', 'First Option');  // Use UUID

            // Submit second batch with keys (not new label)
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: ['opt_1', 'opt_3'] },  // Use keys, not labels
                });
                // Note: Not validating each submission in loop for performance
            }

            // Verify stats
            const stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(20);
        });
    });

    describe('Concurrent Statistics Aggregation', () => {
        test('should compute correct stats while submissions are being added', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select rating',
                questionType: 'select',
                options: [
                    { key: 'rate_1', label: 'Poor' },
                    { key: 'rate_5', label: 'Excellent' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Rating Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Add some initial submissions with keys
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,  // Use UUID
                    submissionData: { [question.id]: 'rate_1' },  // Use key, not label
                });
                // Note: Not validating each submission in loop for performance
            }

            // Concurrently add more submissions and read stats multiple times
            const operations = [
                ...Array.from({ length: 20 }, () =>
                    checkops.createSubmission({
                        formId: form.id,  // Use UUID
                        submissionData: { [question.id]: 'rate_5' },  // Use key, not label
                    })
                ),
                ...Array.from({ length: 3 }, () =>
                    checkops.getSubmissionStats(form.id)  // Use UUID
                ),
            ];

            const results = await Promise.all(operations);

            // Final stats should show all submissions
            const finalStats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(finalStats.totalSubmissions).toBe(30);
            expect(finalStats.questionStats[question.id].answerDistribution['Poor']).toBe(10);
            expect(finalStats.questionStats[question.id].answerDistribution['Excellent']).toBe(20);
        });
    });
});
