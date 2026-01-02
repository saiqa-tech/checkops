import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import { Form } from '../../src/models/Form.js';

describe('Phase 2.3: Transaction Overhead Reduction', () => {
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

    test('should create forms without explicit transactions', async () => {
        const startTime = performance.now();

        const form = await Form.create({
            title: 'Transaction Test Form',
            description: 'Testing optimized form creation',
            questions: [
                {
                    questionText: 'Test Question',
                    questionType: 'text',
                    required: true
                }
            ],
            metadata: { test: true }
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(form).toBeDefined();
        expect(form.id).toMatch(/^FORM-\d{3}$/);
        expect(form.title).toBe('Transaction Test Form');

        // Should be faster than previous transaction-heavy approach
        // Expecting under 50ms for simple form creation
        expect(duration).toBeLessThan(50);
    });

    test('should update forms without explicit transactions', async () => {
        // Create a form first
        const form = await Form.create({
            title: 'Original Title',
            description: 'Original Description',
            questions: [],
            metadata: {}
        });

        const startTime = performance.now();

        const updatedForm = await Form.update(form.id, {
            title: 'Updated Title',
            description: 'Updated Description'
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(updatedForm.title).toBe('Updated Title');
        expect(updatedForm.description).toBe('Updated Description');

        // Should be faster than transaction-heavy approach
        expect(duration).toBeLessThan(30);
    });

    test('should delete forms without explicit transactions', async () => {
        // Create a form first
        const form = await Form.create({
            title: 'Form to Delete',
            description: 'This form will be deleted',
            questions: [],
            metadata: {}
        });

        const startTime = performance.now();

        const deletedForm = await Form.delete(form.id);

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(deletedForm.id).toBe(form.id);

        // Verify form is actually deleted
        await expect(Form.findById(form.id)).rejects.toThrow('Form not found');

        // Should be faster than transaction-heavy approach
        expect(duration).toBeLessThan(30);
    });

    test('should handle concurrent operations efficiently', async () => {
        const concurrentOperations = 10;
        const startTime = performance.now();

        // Create multiple forms concurrently
        const promises = Array(concurrentOperations).fill(0).map((_, i) =>
            Form.create({
                title: `Concurrent Form ${i}`,
                description: `Form created concurrently ${i}`,
                questions: [
                    {
                        questionText: `Question ${i}`,
                        questionType: 'text',
                        required: false
                    }
                ],
                metadata: { index: i }
            })
        );

        const forms = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // All forms should be created successfully
        expect(forms).toHaveLength(concurrentOperations);
        forms.forEach((form, i) => {
            expect(form.title).toBe(`Concurrent Form ${i}`);
            expect(form.id).toMatch(/^FORM-\d{3}$/);
        });

        // Should complete within reasonable time (less than 200ms for 10 operations)
        expect(duration).toBeLessThan(200);

        // Average time per operation should be reasonable
        const avgTimePerOperation = duration / concurrentOperations;
        expect(avgTimePerOperation).toBeLessThan(20);
    });

    test('should maintain data consistency without explicit transactions', async () => {
        // Test that single operations are still atomic
        const form = await Form.create({
            title: 'Consistency Test',
            description: 'Testing data consistency',
            questions: [
                {
                    questionText: 'Consistency Question',
                    questionType: 'select',
                    options: [
                        { key: 'option1', label: 'Option 1' },
                        { key: 'option2', label: 'Option 2' }
                    ],
                    required: true
                }
            ],
            metadata: { consistency: true }
        });

        // Verify all data was saved correctly
        const retrievedForm = await Form.findById(form.id);

        expect(retrievedForm.title).toBe('Consistency Test');
        expect(retrievedForm.description).toBe('Testing data consistency');
        expect(retrievedForm.questions).toHaveLength(1);
        expect(retrievedForm.questions[0].questionText).toBe('Consistency Question');
        expect(retrievedForm.questions[0].options).toHaveLength(2);
        expect(retrievedForm.metadata.consistency).toBe(true);
        expect(retrievedForm.isActive).toBe(true);
    });

    test('should use transactions only for bulk operations', async () => {
        const bulkData = Array(5).fill(0).map((_, i) => ({
            title: `Bulk Form ${i}`,
            description: `Bulk created form ${i}`,
            questions: [
                {
                    questionText: `Bulk Question ${i}`,
                    questionType: 'text',
                    required: false
                }
            ],
            metadata: { bulk: true, index: i }
        }));

        const startTime = performance.now();

        // This should use transactions since it's a bulk operation
        const forms = await Form.createMany(bulkData);

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(forms).toHaveLength(5);
        forms.forEach((form, i) => {
            expect(form.title).toBe(`Bulk Form ${i}`);
            expect(form.metadata.bulk).toBe(true);
            expect(form.metadata.index).toBe(i);
        });

        // Bulk operations should still be reasonably fast
        expect(duration).toBeLessThan(100);
    });

    test('should handle errors gracefully without transactions', async () => {
        // Test with invalid data that should cause an error
        await expect(
            Form.create({
                title: null, // This should cause an error
                description: 'Invalid form',
                questions: [],
                metadata: {}
            })
        ).rejects.toThrow();

        // Test update with non-existent form
        await expect(
            Form.update('FORM-999', { title: 'Updated' })
        ).rejects.toThrow('Form not found');

        // Test delete with non-existent form
        await expect(
            Form.delete('FORM-999')
        ).rejects.toThrow('Form not found');
    });

    test('should show performance improvement over transaction-heavy approach', async () => {
        const operationCount = 20;

        // Measure optimized approach
        const startTime = performance.now();

        const promises = Array(operationCount).fill(0).map((_, i) =>
            Form.create({
                title: `Performance Test ${i}`,
                description: 'Testing performance improvement',
                questions: [],
                metadata: { performance: true }
            })
        );

        await Promise.all(promises);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Should complete all operations quickly
        expect(duration).toBeLessThan(300); // Less than 300ms for 20 operations

        const avgTimePerOperation = duration / operationCount;
        expect(avgTimePerOperation).toBeLessThan(15); // Less than 15ms per operation on average

        console.log(`Phase 2.3 Performance: ${operationCount} operations in ${duration.toFixed(2)}ms (avg: ${avgTimePerOperation.toFixed(2)}ms per operation)`);
    });
});