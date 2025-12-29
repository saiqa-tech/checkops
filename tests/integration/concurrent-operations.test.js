import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

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

        await pool.query('DELETE FROM submissions');
        await pool.query('DELETE FROM forms');
        await pool.query('DELETE FROM question_bank');
        await pool.query('DELETE FROM question_option_history');
        await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");
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

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Create 100 concurrent submissions with different options
            const submissionPromises = Array.from({ length: 100 }, (_, i) => {
                const options = ['Option A', 'Option B', 'Option C'];
                const selectedOption = options[i % 3];

                return checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: selectedOption },
                });
            });

            const submissions = await Promise.all(submissionPromises);

            expect(submissions).toHaveLength(100);
            expect(submissions.every(sub => sub.id)).toBe(true);

            // Verify all submissions stored correctly
            const stats = await checkops.getSubmissionStats(form.id);
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

            const form = await checkops.createForm({
                title: 'Survey Form',
                questions: [{ questionId: question.id }],
            });

            // Create 500 concurrent submissions
            const submissionPromises = Array.from({ length: 500 }, (_, i) => {
                const rating = (i % 5) + 1;
                return checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: `${rating} - ${['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating - 1]}` },
                });
            });

            const submissions = await Promise.all(submissionPromises);

            expect(submissions).toHaveLength(500);

            // Verify stats are accurate
            const stats = await checkops.getSubmissionStats(form.id);
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

            const form = await checkops.createForm({
                title: 'Status Form',
                questions: [{ questionId: question.id }],
            });

            // Create multiple submissions with original label
            const submission1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Active' },
            });

            const submission2 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Active' },
            });

            // Change the label
            await checkops.updateOptionLabel(question.id, 'status_active', 'Live');

            // Submit with new label
            const submission3 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Live' },
            });

            // Verify all submissions reference correct key
            const retrieved1 = await checkops.getSubmission(submission1.id);
            const retrieved2 = await checkops.getSubmission(submission2.id);
            const retrieved3 = await checkops.getSubmission(submission3.id);

            expect(retrieved1._rawData[question.id]).toBe('status_active');
            expect(retrieved2._rawData[question.id]).toBe('status_active');
            expect(retrieved3._rawData[question.id]).toBe('status_active');

            // All should show the updated label
            expect(retrieved1.submissionData[question.id]).toBe('Live');
            expect(retrieved2.submissionData[question.id]).toBe('Live');
            expect(retrieved3.submissionData[question.id]).toBe('Live');

            // Stats should aggregate correctly
            const stats = await checkops.getSubmissionStats(form.id);
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

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit initial response
            const sub1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'High' },
            });

            // Change label
            await checkops.updateOptionLabel(question.id, 'priority_high', 'Critical');

            // Read submission and submit new response after label change
            const retrieved1 = await checkops.getSubmission(sub1.id);
            const newSubmission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Critical' },
            });

            // First submission should show updated label
            expect(retrieved1.submissionData[question.id]).toBe('Critical');
            expect(retrieved1._rawData[question.id]).toBe('priority_high');

            // New submission should also be correct
            const retrievedNew = await checkops.getSubmission(newSubmission.id);
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

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Create many concurrent operations
            const operations = Array.from({ length: 50 }, (_, i) =>
                checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: `Response ${i}` },
                })
            );

            const results = await Promise.all(operations);

            expect(results).toHaveLength(50);
            expect(results.every(r => r.id)).toBe(true);

            // Verify all stored correctly
            const stats = await checkops.getSubmissionStats(form.id);
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

            const form = await checkops.createForm({
                title: 'Multiselect Form',
                questions: [{ questionId: question.id }],
            });

            // Submit first batch with original labels
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: ['Option 1', 'Option 2'] },
                });
            }

            // Change label
            await checkops.updateOptionLabel(question.id, 'opt_1', 'First Option');

            // Submit second batch with new label
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: ['First Option', 'Option 3'] },
                });
            }

            // Verify stats
            const stats = await checkops.getSubmissionStats(form.id);
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

            const form = await checkops.createForm({
                title: 'Rating Form',
                questions: [{ questionId: question.id }],
            });

            // Add some initial submissions
            for (let i = 0; i < 10; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 'Poor' },
                });
            }

            // Concurrently add more submissions and read stats multiple times
            const operations = [
                ...Array.from({ length: 20 }, () =>
                    checkops.createSubmission({
                        formId: form.id,
                        submissionData: { [question.id]: 'Excellent' },
                    })
                ),
                ...Array.from({ length: 3 }, () =>
                    checkops.getSubmissionStats(form.id)
                ),
            ];

            const results = await Promise.all(operations);

            // Final stats should show all submissions
            const finalStats = await checkops.getSubmissionStats(form.id);
            expect(finalStats.totalSubmissions).toBe(30);
            expect(finalStats.questionStats[question.id].answerDistribution['Poor']).toBe(10);
            expect(finalStats.questionStats[question.id].answerDistribution['Excellent']).toBe(20);
        });
    });
});
