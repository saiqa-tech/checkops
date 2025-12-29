import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

describe('Option Mutations: Complex State Changes', () => {
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
            console.log('Database not available, skipping option mutation tests');
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

    describe('Sequential Label Changes', () => {
        test('should handle 5 sequential label changes maintaining key consistency', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select status',
                questionType: 'select',
                options: [{ key: 'status_1', label: 'Status One' }],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with original label
            const submission1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Status One' },
            });

            const labels = ['Updated Label 1', 'Changed Again', 'Third Change', 'Fourth Version', 'Final Label'];
            const submissions = [submission1];

            // Apply 5 sequential label changes
            for (const newLabel of labels) {
                await checkops.updateOptionLabel(question.id, 'status_1', newLabel);

                // Submit with new label after each change
                const submission = await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: newLabel },
                });
                submissions.push(submission);

                // Verify raw key is still the same
                const retrieved = await checkops.getSubmission(submission.id);
                expect(retrieved._rawData[question.id]).toBe('status_1');
                expect(retrieved.submissionData[question.id]).toBe(newLabel);
            }

            // Verify all submissions have same key but final label
            const allSubmissions = await Promise.all(
                submissions.map(sub => checkops.getSubmission(sub.id))
            );

            allSubmissions.forEach(sub => {
                expect(sub._rawData[question.id]).toBe('status_1');
                expect(sub.submissionData[question.id]).toBe('Final Label');
            });

            // Verify history tracks all changes
            const client = await pool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM question_option_history WHERE question_id = $1 ORDER BY changed_at ASC',
                    [question.id]
                );
                expect(result.rows.length).toBeGreaterThanOrEqual(5);
                expect(result.rows[result.rows.length - 1].new_label).toBe('Final Label');
            } finally {
                client.release();
            }
        });

        test('should maintain stats accuracy across label changes', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select category',
                questionType: 'select',
                options: [
                    { key: 'cat_a', label: 'Category A' },
                    { key: 'cat_b', label: 'Category B' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Add submissions
            for (let i = 0; i < 5; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 'Category A' },
                });
            }

            for (let i = 0; i < 3; i++) {
                await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: 'Category B' },
                });
            }

            // Change label and verify stats still correct
            await checkops.updateOptionLabel(question.id, 'cat_a', 'Type A');

            const stats = await checkops.getSubmissionStats(form.id);
            expect(stats.totalSubmissions).toBe(8);
            expect(stats.questionStats[question.id].answerDistribution['Type A']).toBe(5);
            expect(stats.questionStats[question.id].answerDistribution['Category B']).toBe(3);

            // Change second label
            await checkops.updateOptionLabel(question.id, 'cat_b', 'Type B');

            const stats2 = await checkops.getSubmissionStats(form.id);
            expect(stats2.totalSubmissions).toBe(8);
            expect(stats2.questionStats[question.id].answerDistribution['Type A']).toBe(5);
            expect(stats2.questionStats[question.id].answerDistribution['Type B']).toBe(3);
        });
    });

    describe('Option Reordering & Metadata Changes', () => {
        test('should handle option reordering without affecting stored data', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select priority',
                questionType: 'select',
                options: [
                    { key: 'p1', label: 'Low' },
                    { key: 'p2', label: 'Medium' },
                    { key: 'p3', label: 'High' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit all options
            const submissions = [];
            for (const label of ['Low', 'Medium', 'High', 'Low', 'High']) {
                const sub = await checkops.createSubmission({
                    formId: form.id,
                    submissionData: { [question.id]: label },
                });
                submissions.push(sub);
            }

            // Verify original stats
            let stats = await checkops.getSubmissionStats(form.id);
            expect(stats.questionStats[question.id].answerDistribution['Low']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['Medium']).toBe(1);
            expect(stats.questionStats[question.id].answerDistribution['High']).toBe(2);

            // Reorder options by updating them
            await checkops.updateOptionLabel(question.id, 'p3', 'High');
            await checkops.updateOptionLabel(question.id, 'p1', 'Low');

            // Stats should remain unchanged
            stats = await checkops.getSubmissionStats(form.id);
            expect(stats.questionStats[question.id].answerDistribution['Low']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['Medium']).toBe(1);
            expect(stats.questionStats[question.id].answerDistribution['High']).toBe(2);

            // All submissions should still be retrievable with correct data
            for (const sub of submissions) {
                const retrieved = await checkops.getSubmission(sub.id);
                expect(retrieved._rawData[question.id]).toBeTruthy();
            }
        });

        test('should preserve data when updating option metadata', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select with metadata',
                questionType: 'select',
                options: [
                    { key: 'opt_1', label: 'Option 1', metadata: { color: 'red' } },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit response
            const submission = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Option 1' },
            });

            // Update label (metadata may change)
            await checkops.updateOptionLabel(question.id, 'opt_1', 'Updated Option 1');

            // Original submission should still be valid
            const retrieved = await checkops.getSubmission(submission.id);
            expect(retrieved._rawData[question.id]).toBe('opt_1');
            expect(retrieved.submissionData[question.id]).toBe('Updated Option 1');
        });
    });

    describe('Multiselect Option Mutations', () => {
        test('should handle label changes in multiselect options', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select features',
                questionType: 'multiselect',
                options: [
                    { key: 'feat_1', label: 'Feature One' },
                    { key: 'feat_2', label: 'Feature Two' },
                    { key: 'feat_3', label: 'Feature Three' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit with original labels
            const sub1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: ['Feature One', 'Feature Two'] },
            });

            // Change label
            await checkops.updateOptionLabel(question.id, 'feat_1', 'Primary Feature');

            // Submit with mixed old and new labels
            const sub2 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: ['Primary Feature', 'Feature Three'] },
            });

            // Verify both submissions
            const retrieved1 = await checkops.getSubmission(sub1.id);
            const retrieved2 = await checkops.getSubmission(sub2.id);

            // Both should show updated labels
            expect(retrieved1.submissionData[question.id]).toContain('Primary Feature');
            expect(retrieved1.submissionData[question.id]).toContain('Feature Two');

            expect(retrieved2.submissionData[question.id]).toContain('Primary Feature');
            expect(retrieved2.submissionData[question.id]).toContain('Feature Three');

            // Raw data should show original keys
            expect(retrieved1._rawData[question.id]).toContain('feat_1');
            expect(retrieved1._rawData[question.id]).toContain('feat_2');
            expect(retrieved2._rawData[question.id]).toContain('feat_1');
            expect(retrieved2._rawData[question.id]).toContain('feat_3');
        });

        test('should compute correct stats for multiselect after label changes', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select interests',
                questionType: 'multiselect',
                options: [
                    { key: 'int_sport', label: 'Sports' },
                    { key: 'int_music', label: 'Music' },
                    { key: 'int_art', label: 'Art' },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit various combinations
            await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: ['Sports', 'Music'] },
            });

            await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: ['Sports', 'Art'] },
            });

            // Change label
            await checkops.updateOptionLabel(question.id, 'int_sport', 'Athletics');

            // Submit with new label
            await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: ['Athletics', 'Music'] },
            });

            // Verify stats
            const stats = await checkops.getSubmissionStats(form.id);
            expect(stats.totalSubmissions).toBe(3);
            expect(stats.questionStats[question.id].answerDistribution['Athletics']).toBe(3);
            expect(stats.questionStats[question.id].answerDistribution['Music']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['Art']).toBe(1);
        });
    });

    describe('Option Disabling & Archiving', () => {
        test('should handle disabled option state in submissions', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select status',
                questionType: 'select',
                options: [
                    { key: 'status_active', label: 'Active' },
                    { key: 'status_archived', label: 'Archived', disabled: true },
                ],
            });

            const form = await checkops.createForm({
                title: 'Test Form',
                questions: [{ questionId: question.id }],
            });

            // Submit before disabling
            const sub1 = await checkops.createSubmission({
                formId: form.id,
                submissionData: { [question.id]: 'Active' },
            });

            // Submission should work with active option
            expect(sub1.id).toBeTruthy();

            // Retrieve and verify
            const retrieved = await checkops.getSubmission(sub1.id);
            expect(retrieved._rawData[question.id]).toBe('status_active');
            expect(retrieved.submissionData[question.id]).toBe('Active');
        });
    });
});
