/**
 * Test Helper - Data Cleanup
 * 
 * Cleanup functions for v4.0.0 tests
 */

/**
 * Delete all test forms
 * @param {CheckOps} checkops - CheckOps instance
 * @returns {Promise<number>} Number of forms deleted
 */
export async function cleanupForms(checkops) {
    try {
        const forms = await checkops.getAllForms({ limit: 1000 });
        let deleted = 0;

        for (const form of forms) {
            try {
                await checkops.deleteForm(form.id);  // Use UUID
                deleted++;
            } catch (error) {
                console.warn(`Failed to delete form ${form.id}:`, error.message);
            }
        }

        return deleted;
    } catch (error) {
        console.warn('Failed to cleanup forms:', error.message);
        return 0;
    }
}

/**
 * Delete all test questions
 * @param {CheckOps} checkops - CheckOps instance
 * @returns {Promise<number>} Number of questions deleted
 */
export async function cleanupQuestions(checkops) {
    try {
        const questions = await checkops.getAllQuestions({ limit: 1000 });
        let deleted = 0;

        for (const question of questions) {
            try {
                await checkops.deleteQuestion(question.id);  // Use UUID
                deleted++;
            } catch (error) {
                console.warn(`Failed to delete question ${question.id}:`, error.message);
            }
        }

        return deleted;
    } catch (error) {
        console.warn('Failed to cleanup questions:', error.message);
        return 0;
    }
}

/**
 * Delete all test submissions for a form
 * @param {CheckOps} checkops - CheckOps instance
 * @param {string} formId - Form UUID
 * @returns {Promise<number>} Number of submissions deleted
 */
export async function cleanupSubmissions(checkops, formId) {
    try {
        const submissions = await checkops.getSubmissionsByForm(formId, { limit: 1000 });
        let deleted = 0;

        for (const submission of submissions) {
            try {
                await checkops.deleteSubmission(submission.id);  // Use UUID
                deleted++;
            } catch (error) {
                console.warn(`Failed to delete submission ${submission.id}:`, error.message);
            }
        }

        return deleted;
    } catch (error) {
        console.warn('Failed to cleanup submissions:', error.message);
        return 0;
    }
}

/**
 * Delete all test data (forms, questions, submissions)
 * @param {CheckOps} checkops - CheckOps instance
 * @returns {Promise<object>} Cleanup statistics
 */
export async function cleanupAllTestData(checkops) {
    const stats = {
        forms: 0,
        questions: 0,
        submissions: 0
    };

    try {
        // Delete forms (this will cascade delete submissions if foreign key is set)
        stats.forms = await cleanupForms(checkops);

        // Delete questions
        stats.questions = await cleanupQuestions(checkops);

        return stats;
    } catch (error) {
        console.warn('Failed to cleanup all test data:', error.message);
        return stats;
    }
}
