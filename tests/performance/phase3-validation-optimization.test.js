import { describe, test, expect } from '@jest/globals';
import {
    validateAndSanitizeString,
    validateAndSanitizeFormInput,
    validateAndSanitizeQuestions,
    validateAndSanitizeSubmissionData,
    validateAndSanitizeFormsData
} from '../../src/utils/optimizedValidation.js';

describe('Phase 3.2: Validation Pipeline Optimization', () => {
    describe('Single-Pass String Validation', () => {
        test('should validate and sanitize strings in one pass', () => {
            const input = '  Test String  ';
            const result = validateAndSanitizeString(input, 'Test', 1, 50);

            expect(result).toBe('Test String');
        });

        test('should handle validation errors efficiently', () => {
            expect(() => {
                validateAndSanitizeString('', 'Required Field', 1, 50);
            }).toThrow('Required Field is required');

            expect(() => {
                validateAndSanitizeString('a'.repeat(100), 'Long Field', 1, 50);
            }).toThrow('Long Field must be between 1 and 50 characters');
        });

        test('should handle null and undefined values', () => {
            const result1 = validateAndSanitizeString(null, 'Optional', 0, 50);
            expect(result1).toBe('');

            const result2 = validateAndSanitizeString(undefined, 'Optional', 0, 50);
            expect(result2).toBe('');
        });
    });

    describe('Form Input Validation Optimization', () => {
        test('should validate complete form input in single pass', () => {
            const formInput = {
                title: '  Test Form  ',
                description: '  Test Description  ',
                questions: [
                    {
                        questionText: 'Test Question',
                        questionType: 'text',
                        required: true,
                        metadata: {}
                    }
                ],
                metadata: { test: true }
            };

            const result = validateAndSanitizeFormInput(formInput);

            expect(result.title).toBe('Test Form');
            expect(result.description).toBe('Test Description');
            expect(result.questions).toHaveLength(1);
            expect(result.questions[0].questionText).toBe('Test Question');
            expect(result.metadata.test).toBe(true);
        });

        test('should collect all validation errors at once', () => {
            const invalidFormInput = {
                title: '', // Too short
                description: 'a'.repeat(6000), // Too long
                questions: [], // Empty array
                metadata: null
            };

            expect(() => {
                validateAndSanitizeFormInput(invalidFormInput);
            }).toThrow(/Validation failed:/);
        });

        test('should handle complex question validation', () => {
            const formInput = {
                title: 'Complex Form',
                description: 'Form with various question types',
                questions: [
                    {
                        questionText: 'Text Question',
                        questionType: 'text',
                        required: false
                    },
                    {
                        questionText: 'Select Question',
                        questionType: 'select',
                        options: [
                            { key: 'opt1', label: 'Option 1' },
                            { key: 'opt2', label: 'Option 2' }
                        ],
                        required: true
                    },
                    {
                        questionText: 'Multi-select Question',
                        questionType: 'multiselect',
                        options: ['Option A', 'Option B', 'Option C'],
                        required: false
                    }
                ],
                metadata: {}
            };

            const result = validateAndSanitizeFormInput(formInput);

            expect(result.questions).toHaveLength(3);
            expect(result.questions[1].options).toHaveLength(2);
            expect(result.questions[2].options).toHaveLength(3);
            expect(result.questions[2].options[0]).toHaveProperty('key');
            expect(result.questions[2].options[0]).toHaveProperty('label');
        });
    });

    describe('Submission Data Validation', () => {
        test('should validate submission data against questions efficiently', () => {
            const questions = [
                {
                    id: 'q1',
                    questionText: 'Name',
                    questionType: 'text',
                    required: true
                },
                {
                    id: 'q2',
                    questionText: 'Email',
                    questionType: 'email',
                    required: true
                },
                {
                    id: 'q3',
                    questionText: 'Age',
                    questionType: 'number',
                    required: false
                },
                {
                    id: 'q4',
                    questionText: 'Country',
                    questionType: 'select',
                    options: [
                        { key: 'us', label: 'United States' },
                        { key: 'ca', label: 'Canada' }
                    ],
                    required: false
                }
            ];

            const submissionData = {
                q1: 'John Doe',
                q2: 'john@example.com',
                q3: 25,
                q4: 'us'
            };

            const result = validateAndSanitizeSubmissionData(submissionData, questions);

            expect(result.q1).toBe('John Doe');
            expect(result.q2).toBe('john@example.com');
            expect(result.q3).toBe(25);
            expect(result.q4).toBe('us');
        });

        test('should handle validation errors for submissions', () => {
            const questions = [
                {
                    id: 'q1',
                    questionText: 'Required Field',
                    questionType: 'text',
                    required: true
                },
                {
                    id: 'q2',
                    questionText: 'Email Field',
                    questionType: 'email',
                    required: false
                }
            ];

            const invalidSubmissionData = {
                q2: 'invalid-email'
                // q1 is missing but required
            };

            expect(() => {
                validateAndSanitizeSubmissionData(invalidSubmissionData, questions);
            }).toThrow(/Submission validation failed:/);
        });

        test('should handle multi-select questions', () => {
            const questions = [
                {
                    id: 'q1',
                    questionText: 'Multi-select Question',
                    questionType: 'multiselect',
                    options: [
                        { key: 'opt1', label: 'Option 1' },
                        { key: 'opt2', label: 'Option 2' },
                        { key: 'opt3', label: 'Option 3' }
                    ],
                    required: false
                }
            ];

            const submissionData = {
                q1: ['opt1', 'opt3']
            };

            const result = validateAndSanitizeSubmissionData(submissionData, questions);
            expect(result.q1).toEqual(['opt1', 'opt3']);
        });
    });

    describe('Batch Validation Performance', () => {
        test('should validate multiple forms efficiently', () => {
            const formsData = Array(20).fill(0).map((_, i) => ({
                title: `Form ${i}`,
                description: `Description ${i}`,
                questions: [
                    {
                        questionText: `Question ${i}`,
                        questionType: 'text',
                        required: false
                    }
                ],
                metadata: { index: i }
            }));

            const startTime = performance.now();
            const results = validateAndSanitizeFormsData(formsData);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(results).toHaveLength(20);
            expect(duration).toBeLessThan(50); // Should be very fast

            console.log(`Batch form validation: 20 forms in ${duration.toFixed(2)}ms`);
        });

        test('should show performance improvement over individual validation', () => {
            const formsData = Array(10).fill(0).map((_, i) => ({
                title: `Performance Form ${i}`,
                description: `Performance test ${i}`,
                questions: [
                    {
                        questionText: `Performance Question ${i}`,
                        questionType: 'text'
                    }
                ],
                metadata: {}
            }));

            // Individual validation
            const individualStart = performance.now();
            const individualResults = [];
            for (const formData of formsData) {
                individualResults.push(validateAndSanitizeFormInput(formData));
            }
            const individualEnd = performance.now();
            const individualDuration = individualEnd - individualStart;

            // Batch validation
            const batchStart = performance.now();
            const batchResults = validateAndSanitizeFormsData(formsData);
            const batchEnd = performance.now();
            const batchDuration = batchEnd - batchStart;

            expect(individualResults).toHaveLength(10);
            expect(batchResults).toHaveLength(10);

            console.log(`Validation performance comparison:`);
            console.log(`  Individual: ${individualDuration.toFixed(2)}ms`);
            console.log(`  Batch: ${batchDuration.toFixed(2)}ms`);

            // Batch should be at least as fast, often faster due to reduced overhead
            expect(batchDuration).toBeLessThanOrEqual(individualDuration * 1.1);
        });
    });

    describe('Error Aggregation', () => {
        test('should collect and report all validation errors', () => {
            const invalidFormInput = {
                title: '', // Required
                description: 'a'.repeat(6000), // Too long
                questions: [
                    {
                        questionText: '', // Required
                        questionType: 'invalid-type', // Invalid
                        options: null // Required for select types
                    }
                ],
                metadata: 'invalid' // Should be object
            };

            let errorMessage = '';
            try {
                validateAndSanitizeFormInput(invalidFormInput);
            } catch (error) {
                errorMessage = error.message;
            }

            expect(errorMessage).toContain('Validation failed:');
            expect(errorMessage).toContain('Title is required');
            expect(errorMessage).toContain('Description must be between');
        });

        test('should handle batch validation errors', () => {
            const mixedFormsData = [
                {
                    title: 'Valid Form',
                    description: 'This is valid',
                    questions: [
                        {
                            questionText: 'Valid Question',
                            questionType: 'text'
                        }
                    ],
                    metadata: {}
                },
                {
                    title: '', // Invalid
                    description: 'Invalid form',
                    questions: [],
                    metadata: {}
                }
            ];

            expect(() => {
                validateAndSanitizeFormsData(mixedFormsData);
            }).toThrow(/Batch validation failed:/);
        });
    });

    describe('Edge Cases and Performance', () => {
        test('should handle large form validation efficiently', () => {
            const largeForm = {
                title: 'Large Form',
                description: 'Form with many questions',
                questions: Array(100).fill(0).map((_, i) => ({
                    questionText: `Question ${i}`,
                    questionType: i % 4 === 0 ? 'select' : 'text',
                    options: i % 4 === 0 ? [
                        { key: `opt${i}_1`, label: `Option ${i} 1` },
                        { key: `opt${i}_2`, label: `Option ${i} 2` }
                    ] : null,
                    required: i % 3 === 0,
                    metadata: { index: i }
                })),
                metadata: { large: true }
            };

            const startTime = performance.now();
            const result = validateAndSanitizeFormInput(largeForm);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(result.questions).toHaveLength(100);
            expect(duration).toBeLessThan(100); // Should handle 100 questions quickly

            console.log(`Large form validation: 100 questions in ${duration.toFixed(2)}ms`);
        });

        test('should handle complex nested validation', () => {
            const complexForm = {
                title: 'Complex Form',
                description: 'Form with complex validation rules',
                questions: [
                    {
                        questionText: 'Complex Select',
                        questionType: 'select',
                        options: Array(50).fill(0).map((_, i) => ({
                            key: `complex_opt_${i}`,
                            label: `Complex Option ${i}`,
                            metadata: { value: i, category: i % 5 }
                        })),
                        validationRules: {
                            required: true,
                            customRule: 'complex validation'
                        },
                        metadata: {
                            category: 'complex',
                            weight: 1.5,
                            tags: ['important', 'complex', 'validation']
                        }
                    }
                ],
                metadata: {
                    version: '2.0',
                    complexity: 'high',
                    features: ['validation', 'options', 'metadata']
                }
            };

            const startTime = performance.now();
            const result = validateAndSanitizeFormInput(complexForm);
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(result.questions[0].options).toHaveLength(50);
            expect(duration).toBeLessThan(50); // Should handle complexity efficiently

            console.log(`Complex form validation: ${duration.toFixed(2)}ms`);
        });
    });
});