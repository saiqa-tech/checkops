import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';
import { isUUID, isSID, validateFormIds, validateQuestionIds, validateSubmissionIds } from '../helpers/validators.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

describe('Critical Path: End-to-End Option Key System', () => {
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
            console.log('Database not available, skipping critical path tests');
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

    describe('Complete Workflow: Form Creation → Submission → Label Change → Statistics', () => {
        test('should maintain data integrity through complete workflow', async () => {
            if (!checkops) return;

            // Step 1: Create a question with options
            const question = await checkops.createQuestion({
                questionText: 'What is your priority level?',
                questionType: 'select',
                options: [
                    { key: 'priority_high', label: 'High' },
                    { key: 'priority_medium', label: 'Medium' },
                    { key: 'priority_low', label: 'Low' },
                ],
            });

            // Validate UUID and SID
            validateQuestionIds(question);
            expect(question.options).toHaveLength(3);

            // Step 2: Create a form with the question
            const form = await checkops.createForm({
                title: 'Priority Assessment Form',
                description: 'Assess task priorities',
                questions: [{ questionId: question.id, required: true }],  // Use UUID
            });

            // Validate UUID and SID
            validateFormIds(form);
            expect(form.isActive).toBe(true);

            // Step 3: Submit responses with keys (not labels)
            const submission1 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(submission1);

            const submission2 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(submission2);

            const submission3 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_medium' },  // Use key, not label
            });
            validateSubmissionIds(submission3);

            // Verify submissions stored with keys internally
            const retrieved1 = await checkops.getSubmission(submission1.id);  // Use UUID
            expect(retrieved1._rawData[question.id]).toBe('priority_high');
            expect(retrieved1.submissionData[question.id]).toBe('High');

            // Step 4: Get initial statistics
            let stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(3);
            expect(stats.questionStats[question.id].totalAnswers).toBe(3);
            expect(stats.questionStats[question.id].answerDistribution['High']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['Medium']).toBe(1);

            // Step 5: Change option label (e.g., "High" → "Critical")
            const updatedQuestion = await checkops.updateOptionLabel(
                question.id,  // Use UUID
                'priority_high',
                'Critical',
                'admin@example.com'
            );
            validateQuestionIds(updatedQuestion);

            expect(updatedQuestion.options[0].key).toBe('priority_high');
            expect(updatedQuestion.options[0].label).toBe('Critical');

            // Step 6: Submit new responses with key (not updated label)
            const submission4 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(submission4);

            const submission5 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'priority_high' },  // Use key, not label
            });
            validateSubmissionIds(submission5);

            // Verify new submissions use correct key
            const retrieved4 = await checkops.getSubmission(submission4.id);  // Use UUID
            expect(retrieved4._rawData[question.id]).toBe('priority_high');
            expect(retrieved4.submissionData[question.id]).toBe('Critical');

            // Step 7: Verify statistics aggregate correctly by key
            stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.totalSubmissions).toBe(5);

            // All 'High'/'Critical' responses should be aggregated together
            expect(stats.questionStats[question.id].totalAnswers).toBe(5);
            expect(stats.questionStats[question.id].answerDistribution['Critical']).toBe(4); // 2 old + 2 new
            expect(stats.questionStats[question.id].answerDistribution['Medium']).toBe(1);

            // Verify internal key distribution
            expect(stats.questionStats[question.id]._keyDistribution['priority_high']).toBe(4);

            // Step 8: Verify option history tracking
            const history = await checkops.getOptionHistory(question.id, 'priority_high');  // Use UUID
            expect(history).toHaveLength(1);
            expect(history[0].oldLabel).toBe('High');
            expect(history[0].newLabel).toBe('Critical');
            expect(history[0].changedBy).toBe('admin@example.com');

            // Step 9: Verify all old submissions now show new label
            const oldSubmissionsFetch = await checkops.getSubmissionsByForm(form.id, { limit: 5 });  // Use UUID
            const oldSub1 = oldSubmissionsFetch.find(s => s.id === submission1.id);
            const oldSub2 = oldSubmissionsFetch.find(s => s.id === submission2.id);

            expect(oldSub1.submissionData[question.id]).toBe('Critical');
            expect(oldSub2.submissionData[question.id]).toBe('Critical');
            expect(oldSub1._rawData[question.id]).toBe('priority_high');
            expect(oldSub2._rawData[question.id]).toBe('priority_high');
        });

        test('should handle multiselect option changes with statistics aggregation', async () => {
            if (!checkops) return;

            // Create multiselect question
            const question = await checkops.createQuestion({
                questionText: 'Select applicable skills',
                questionType: 'multiselect',
                options: [
                    { key: 'skill_js', label: 'JavaScript' },
                    { key: 'skill_python', label: 'Python' },
                    { key: 'skill_sql', label: 'SQL' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Skills Assessment',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            // Initial submissions with keys
            await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: ['skill_js', 'skill_sql'] },  // Use keys, not labels
            });

            await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: ['skill_js'] },  // Use keys, not labels
            });

            await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: ['skill_python', 'skill_sql'] },  // Use keys, not labels
            });

            // Get initial stats
            let stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.questionStats[question.id].answerDistribution['JavaScript']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['Python']).toBe(1);
            expect(stats.questionStats[question.id].answerDistribution['SQL']).toBe(2);

            // Update label
            await checkops.updateOptionLabel(question.id, 'skill_js', 'JavaScript/ES6+');  // Use UUID

            // New submission with key (not updated label)
            await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: ['skill_js', 'skill_python'] },  // Use keys, not labels
            });

            // Verify stats are aggregated correctly
            stats = await checkops.getSubmissionStats(form.id);  // Use UUID
            expect(stats.questionStats[question.id].answerDistribution['JavaScript/ES6+']).toBe(3); // 2 old + 1 new
            expect(stats.questionStats[question.id].answerDistribution['Python']).toBe(2);
            expect(stats.questionStats[question.id].answerDistribution['SQL']).toBe(2);
        });

        test('should handle option key immutability across complex workflows', async () => {
            if (!checkops) return;

            const question = await checkops.createQuestion({
                questionText: 'Select rating',
                questionType: 'select',
                options: [
                    { key: 'rating_5', label: '5 - Excellent' },
                    { key: 'rating_4', label: '4 - Good' },
                    { key: 'rating_3', label: '3 - Average' },
                    { key: 'rating_2', label: '2 - Poor' },
                    { key: 'rating_1', label: '1 - Very Poor' },
                ],
            });
            validateQuestionIds(question);

            const form = await checkops.createForm({
                title: 'Feedback Form',
                questions: [{ questionId: question.id }],  // Use UUID
            });
            validateFormIds(form);

            const originalKey = 'rating_5';

            // Submit with key (not label)
            const sub1 = await checkops.createSubmission({
                formId: form.id,  // Use UUID
                submissionData: { [question.id]: 'rating_5' },  // Use key, not label
            });
            validateSubmissionIds(sub1);

            // Change label multiple times
            await checkops.updateOptionLabel(question.id, originalKey, '5 - Excellent (Best)');  // Use UUID
            await checkops.updateOptionLabel(question.id, originalKey, '5 - Outstanding');  // Use UUID
            await checkops.updateOptionLabel(question.id, originalKey, '★★★★★');  // Use UUID

            // Get current state
            const currentQuestion = await checkops.getQuestion(question.id);  // Use UUID
            validateQuestionIds(currentQuestion);
            const ratingOption = currentQuestion.options.find(opt => opt.key === originalKey);

            expect(ratingOption.key).toBe(originalKey); // Key never changed
            expect(ratingOption.label).toBe('★★★★★'); // Label is current

            // Verify submission still references correct option
            const retrieved1 = await checkops.getSubmission(sub1.id);  // Use UUID
            expect(retrieved1._rawData[question.id]).toBe(originalKey);
            expect(retrieved1.submissionData[question.id]).toBe('★★★★★');

            // Verify history chain
            const history = await checkops.getOptionHistory(question.id, originalKey);  // Use UUID
            expect(history.length).toBeGreaterThanOrEqual(3);
        });
    });
});