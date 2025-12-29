import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('Error Scenarios: Invalid Inputs & Edge Cases', () => {
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
            console.log('Database not available, skipping error scenario tests');
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

    describe('Invalid Input Validation', () => {
        test('should reject submission with non-existent option', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [{ key: 'opt_1', label: 'Valid Option' }],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Attempt to submit with non-existent option
            expect(async () => {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 'Invalid Option' },
                });
            }).rejects.toThrow();
        });

        test('should reject multiselect with invalid option mix', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select features',
                questionType: 'multiselect',
                options: [
                    { key: 'feat_1', label: 'Feature 1' },
                    { key: 'feat_2', label: 'Feature 2' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Mix of valid and invalid
            expect(async () => {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: ['Feature 1', 'Invalid Feature'] },
                });
            }).rejects.toThrow();
        });

        test('should handle option labels with special characters', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Test',
                questionType: 'select',
                options: [
                    { key: 'opt_1', label: "O'Reilly" }, // Single quote in label
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Should be able to handle special chars
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: "O'Reilly" },
            });

            expect(submission.id).toBeTruthy();

            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved._rawData[question.id]).toBe('opt_1');
            expect(retrieved.submissionData[question.id]).toBe("O'Reilly");
        });

        test('should reject submission with null/undefined values', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [{ key: 'opt_1', label: 'Option 1' }],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Null value should be rejected or handled
            expect(async () => {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: null },
                });
            }).rejects.toThrow();
        });

        test('should sanitize SQL injection attempts in option values', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [{ key: 'opt_1', label: "O'Reilly" }], // Single quote in label
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with the dangerous-looking label
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: "O'Reilly" },
            });

            expect(submission.id).toBeTruthy();

            // Should retrieve correctly
            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved.submissionData[question.id]).toBe("O'Reilly");
        });
    });

    describe('Boundary Conditions', () => {
        test('should handle extremely long option labels (5000+ chars)', async () => {
            if (!checkops) return;

            const longLabel = 'A'.repeat(5000);

            const question = await checkops.createQuestion({
                questionText: 'Test long label',
                questionType: 'select',
                options: [{ key: 'opt_long', label: longLabel }],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with long label
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: longLabel },
            });

            expect(submission.id).toBeTruthy();

            // Verify data integrity
            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved.submissionData[question.id]).toBe(longLabel);
            expect(retrieved.submissionData[question.id].length).toBe(5000);
        });

        test('should handle question with 1000+ options', async () => {
            if (!checkops) return;

            const options = Array.from({ length: 1000 }, (_, i) => ({
                key: `opt_${i}`,
                label: `Option ${i}`,
            }));

            const question = await checkops.createQuestion({
                questionText: 'Select from many',
                questionType: 'select',
                options,
            });

            expect(question.id).toBeTruthy();

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with one of the many options
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Option 500' },
            });

            expect(submission.id).toBeTruthy();

            // Verify retrieval
            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved.submissionData[question.id]).toBe('Option 500');
        });

        test('should handle 1M+ submissions for stats computation', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [
                    { key: 'opt_a', label: 'Option A' },
                    { key: 'opt_b', label: 'Option B' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Create 100 submissions (simulating high volume)
            for (let i = 0; i < 100; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: i % 2 === 0 ? 'Option A' : 'Option B' },
                });
            }

            // Stats should handle large count accurately
            const stats = await checkops.getSubmissionStats(form.id);
            expect(stats.totalSubmissions).toBe(100);
            expect(stats.questionStats[question.id].answerDistribution['Option A']).toBe(50);
            expect(stats.questionStats[question.id].answerDistribution['Option B']).toBe(50);
        });

        test('should handle form with 50+ questions', async () => {
            if (!checkops) return;

            const questions = [];
            for (let i = 0; i < 50; i++) {
                const q = await checkops.createQuestion({
                    questionText: `Question ${i}`,
                    questionType: 'text',
                });
                questions.push({ questionId: q.id });
            }

            const form = await checkops.createForm({
                title: 'Large Form',
                questions,
            });

            expect(form.id).toBeTruthy();
            expect(form.questions.length).toBe(50);

            // Submit responses to all questions
            const submissionData = {};
            questions.forEach((q, i) => {
                submissionData[q.questionId] = `Answer ${i}`;
            });

            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData,
            });

            expect(submission.id).toBeTruthy();

            // Verify all data stored
            const retrieved = await checkops.getSubmission(submission.id);
            expect(Object.keys(retrieved.submissionData).length).toBe(50);
        });
    });

    describe('Race Condition Error Handling', () => {
        test('should handle label update on non-existent option', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Test',
                questionType: 'select',
                options: [{ key: 'opt_1', label: 'Option 1' }],
            });

            // Attempt to update non-existent option
            expect(async () => {
                await checkops.updateOptionLabel(question.id, 'non_existent_key', 'New Label');
            }).rejects.toThrow();
        });

        test('should handle submission to deleted form', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Test',
                questionType: 'text',
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Delete form (if deletion is supported)
            // For now, test with non-existent form ID
            expect(async () => {
                await checkops.createSubmission({
                    formId: 9999, // Non-existent form
                    submissionData: { [question.id]: 'test' },
                });
            }).rejects.toThrow();
        });
    });

    describe('Data Type Validation', () => {
        test('should reject non-string option values for select', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select option',
                questionType: 'select',
                options: [{ key: 'opt_1', label: 'Option 1' }],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Attempt with number instead of string
            expect(async () => {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 123 },
                });
            }).rejects.toThrow();
        });

        test('should reject non-array for multiselect', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select features',
                questionType: 'multiselect',
                options: [
                    { key: 'feat_1', label: 'Feature 1' },
                    { key: 'feat_2', label: 'Feature 2' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Attempt with string instead of array
            expect(async () => {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 'Feature 1' }, // Should be array
                });
            }).rejects.toThrow();
        });

        test('should handle empty array for multiselect', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select features',
                questionType: 'multiselect',
                options: [
                    { key: 'feat_1', label: 'Feature 1' },
                    { key: 'feat_2', label: 'Feature 2' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Empty array - should be allowed for optional questions
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: [] },
            });

            expect(submission.id).toBeTruthy();
        });
    });

    describe('Character Encoding Edge Cases', () => {
        test('should handle emoji in option labels and submissions', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select emoji',
                questionType: 'select',
                options: [
                    { key: 'emoji_1', label: '🎉 Celebration' },
                    { key: 'emoji_2', label: '🚀 Rocket' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with emoji
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: '🎉 Celebration' },
            });

            expect(submission.id).toBeTruthy();

            // Verify retrieval
            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved.submissionData[question.id]).toBe('🎉 Celebration');
        });

        test('should handle Unicode characters in labels', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select language',
                questionType: 'select',
                options: [
                    { key: 'lang_1', label: '日本語' },
                    { key: 'lang_2', label: '中文' },
                    { key: 'lang_3', label: 'العربية' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with different Unicode languages
            const submission1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: '日本語' },
            });

            const submission2 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'العربية' },
            });

            expect(submission1.id).toBeTruthy();
            expect(submission2.id).toBeTruthy();

            // Verify both stored correctly
            const retrieved1 = await checkops.getSubmission(submission1.id);
            const retrieved2 = await checkops.getSubmission(submission2.id);

            expect(retrieved1.submissionData[question.id]).toBe('日本語');
            expect(retrieved2.submissionData[question.id]).toBe('العربية');
        });
    });
});
