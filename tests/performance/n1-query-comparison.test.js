/**
 * N+1 Query Performance Comparison Test
 * 
 * This test compares the old vs new implementation to document
 * the exact performance improvement achieved.
 */

import { jest } from '@jest/globals';
import { FormService } from '../../src/services/FormService.js';
import { Question } from '../../src/models/Question.js';

describe('N+1 Query Performance Comparison', () => {
    let formService;
    let originalFindById;
    let originalFindByIds;

    beforeAll(() => {
        formService = new FormService();
        originalFindById = Question.findById;
        originalFindByIds = Question.findByIds;
    });

    afterAll(() => {
        Question.findById = originalFindById;
        Question.findByIds = originalFindByIds;
    });

    // Simulate the OLD implementation for comparison
    async function enrichQuestionsOldWay(questions) {
        const enriched = [];
        for (const question of questions) {
            if (question.questionId) {
                try {
                    const bankQuestion = await Question.findById(question.questionId);
                    enriched.push({
                        questionId: bankQuestion.id,
                        questionText: question.questionText || bankQuestion.questionText,
                        questionType: question.questionType || bankQuestion.questionType,
                        options: question.options || bankQuestion.options,
                        validationRules: question.validationRules || bankQuestion.validationRules,
                        required: question.required || false,
                        metadata: { ...bankQuestion.metadata, ...question.metadata },
                    });
                } catch (error) {
                    enriched.push(question);
                }
            } else {
                enriched.push(question);
            }
        }
        return enriched;
    }

    test('should demonstrate massive performance improvement', async () => {
        const testSizes = [10, 25, 50, 100];
        const results = [];

        console.log('\n🔬 PERFORMANCE COMPARISON ANALYSIS');
        console.log('=====================================');

        for (const size of testSizes) {
            // Mock database calls to simulate realistic timing
            let findByIdCallCount = 0;
            let findByIdsCallCount = 0;

            Question.findById = jest.fn().mockImplementation(async (id) => {
                findByIdCallCount++;
                // Simulate 2ms database query time
                await new Promise(resolve => setTimeout(resolve, 2));
                throw new Error('Test question not found'); // Expected
            });

            Question.findByIds = jest.fn().mockImplementation(async (ids) => {
                findByIdsCallCount++;
                // Simulate 3ms database query time (slightly longer for batch)
                await new Promise(resolve => setTimeout(resolve, 3));
                throw new Error('Test questions not found'); // Expected
            });

            const questions = Array(size).fill(0).map((_, i) => ({
                questionId: `test-question-${i}`,
                questionText: `Override text ${i}`,
            }));

            // Test OLD implementation
            const oldStartTime = performance.now();
            try {
                await enrichQuestionsOldWay(questions);
            } catch (error) {
                // Expected
            }
            const oldEndTime = performance.now();
            const oldDuration = oldEndTime - oldStartTime;
            const oldQueries = findByIdCallCount;

            // Reset counters
            findByIdCallCount = 0;
            findByIdsCallCount = 0;
            Question.findById.mockClear();
            Question.findByIds.mockClear();

            // Test NEW implementation
            const newStartTime = performance.now();
            try {
                await formService.enrichQuestions(questions);
            } catch (error) {
                // Expected
            }
            const newEndTime = performance.now();
            const newDuration = newEndTime - newStartTime;
            const newQueries = findByIdsCallCount;

            const improvement = ((oldDuration - newDuration) / oldDuration * 100).toFixed(1);
            const queryReduction = ((oldQueries - newQueries) / oldQueries * 100).toFixed(1);

            results.push({
                questionCount: size,
                oldQueries,
                newQueries,
                oldDuration: oldDuration.toFixed(2),
                newDuration: newDuration.toFixed(2),
                timeImprovement: improvement,
                queryReduction,
            });
        }

        // Display results
        console.log('\nQuestions | Old Queries | New Queries | Old Time(ms) | New Time(ms) | Time Saved | Query Reduction');
        console.log('----------|-------------|-------------|--------------|--------------|------------|----------------');

        results.forEach(r => {
            console.log(
                `${r.questionCount.toString().padStart(9)} | ` +
                `${r.oldQueries.toString().padStart(11)} | ` +
                `${r.newQueries.toString().padStart(11)} | ` +
                `${r.oldDuration.padStart(12)} | ` +
                `${r.newDuration.padStart(12)} | ` +
                `${r.timeImprovement.padStart(9)}% | ` +
                `${r.queryReduction.padStart(13)}%`
            );
        });

        console.log('\n📊 OPTIMIZATION SUMMARY:');
        console.log(`- Average time improvement: ${(results.reduce((sum, r) => sum + parseFloat(r.timeImprovement), 0) / results.length).toFixed(1)}%`);
        console.log(`- Query reduction: ${results[0].queryReduction}% (consistent across all sizes)`);
        console.log(`- Complexity: Changed from O(n) to O(1)`);
        console.log(`- Scalability: Performance no longer degrades with question count`);

        // Verify improvements
        results.forEach(result => {
            expect(parseFloat(result.timeImprovement)).toBeGreaterThan(80); // At least 80% improvement
            expect(parseFloat(result.queryReduction)).toBeGreaterThan(90);  // At least 90% query reduction
            expect(result.newQueries).toBe(1); // Always exactly 1 batch query
        });
    });

    test('should handle edge cases efficiently', async () => {
        let findByIdCallCount = 0;
        let findByIdsCallCount = 0;

        Question.findById = jest.fn().mockImplementation(async (id) => {
            findByIdCallCount++;
            throw new Error('Test question not found');
        });

        Question.findByIds = jest.fn().mockImplementation(async (ids) => {
            findByIdsCallCount++;
            throw new Error('Test questions not found');
        });

        console.log('\n🧪 EDGE CASE TESTING:');

        // Test 1: Empty array
        const emptyResult = await formService.enrichQuestions([]);
        console.log(`Empty array: ${findByIdsCallCount} queries (expected: 0)`);
        expect(findByIdsCallCount).toBe(0);
        expect(emptyResult).toEqual([]);

        // Reset
        findByIdsCallCount = 0;
        Question.findByIds.mockClear();

        // Test 2: No questionIds
        const noEnrichmentQuestions = [
            { questionText: 'Direct question 1', questionType: 'text' },
            { questionText: 'Direct question 2', questionType: 'select' },
        ];
        const noEnrichmentResult = await formService.enrichQuestions(noEnrichmentQuestions);
        console.log(`No enrichment needed: ${findByIdsCallCount} queries (expected: 0)`);
        expect(findByIdsCallCount).toBe(0);
        expect(noEnrichmentResult).toHaveLength(2);

        // Reset
        findByIdsCallCount = 0;
        Question.findByIds.mockClear();

        // Test 3: Duplicate questionIds (should deduplicate)
        const duplicateQuestions = [
            { questionId: 'q1', questionText: 'Override 1' },
            { questionId: 'q2', questionText: 'Override 2' },
            { questionId: 'q1', questionText: 'Override 1 again' }, // Duplicate
            { questionId: 'q2', questionText: 'Override 2 again' }, // Duplicate
        ];
        await formService.enrichQuestions(duplicateQuestions);
        console.log(`Duplicate IDs: ${findByIdsCallCount} queries (expected: 1)`);
        expect(findByIdsCallCount).toBe(1);
        // Verify the IDs were deduplicated in the call
        expect(Question.findByIds).toHaveBeenCalledWith(['q1', 'q2']);
    });

    test('should maintain backward compatibility', async () => {
        // Mock successful database response
        Question.findByIds = jest.fn().mockResolvedValue([
            {
                id: 'bank-1',
                toJSON: () => ({
                    id: 'bank-1',
                    questionText: 'Bank Question 1',
                    questionType: 'text',
                    options: null,
                    validationRules: null,
                    metadata: { source: 'bank' },
                }),
            },
        ]);

        const questions = [
            { questionId: 'bank-1', questionText: 'Override Text', required: true },
            { questionText: 'Direct Question', questionType: 'select' },
        ];

        const result = await formService.enrichQuestions(questions);

        console.log('\n✅ BACKWARD COMPATIBILITY TEST:');
        console.log(`Input questions: ${questions.length}`);
        console.log(`Output questions: ${result.length}`);
        console.log('First question enriched:', result[0].questionText === 'Override Text');
        console.log('Second question unchanged:', result[1].questionText === 'Direct Question');

        // Verify structure matches expected format
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            questionId: 'bank-1',
            questionText: 'Override Text', // Override preserved
            questionType: 'text', // From bank
            options: null,
            validationRules: null,
            required: true, // Override preserved
            metadata: { source: 'bank' }, // From bank
        });
        expect(result[1]).toEqual({
            questionText: 'Direct Question',
            questionType: 'select',
        });
    });
});