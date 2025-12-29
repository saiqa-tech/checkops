import { CheckOps } from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

describe('Load Testing: Concurrent Submissions', () => {
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
            console.log('Database not available, skipping load tests');
            checkops = null;
        }
    });

    afterAll(async () => {
        if (checkops) {
            await checkops.close();
        }
    });

    describe('Bulk Submissions to Single Form', () => {
        beforeEach(async () => {
            if (!checkops) return;

            await pool.query('DELETE FROM submissions');
            await pool.query('DELETE FROM forms');
            await pool.query('DELETE FROM question_bank');
            await pool.query('DELETE FROM question_option_history');
            await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");
        });

        test('should handle 100 concurrent submissions without data corruption', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Bulk Submission Test',
                questions: [
                    {
                        id: 'name_field',
                        questionText: 'Name',
                        questionType: 'text',
                        required: true
                    },
                    {
                        id: 'status_field',
                        questionText: 'Status',
                        questionType: 'select',
                        required: true,
                        options: ['Active', 'Pending', 'Completed']
                    }
                ]
            });
            const formId = form.id;

            if (!formId) {
                console.error('Form creation failed:', form);
                throw new Error('Form ID is undefined');
            }

            const promises = Array(100).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        name_field: `User ${i}`,
                        status_field: ['Active', 'Pending', 'Completed'][i % 3]
                    }
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(100);
            expect(results.every(r => r.id)).toBe(true);

            // Verify unique submission IDs
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(100);

            expect(duration).toBeLessThan(10000);
            console.log(`✓ Created 100 submissions in ${duration}ms (avg: ${(duration / 100).toFixed(2)}ms per submission)`);
        }, 20000);

        test('should handle 500 concurrent submissions maintaining data integrity', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Bulk Submission Test 500',
                questions: [
                    {
                        questionText: 'Name',
                        questionType: 'text',
                        required: true
                    },
                    {
                        questionText: 'Status',
                        questionType: 'select',
                        required: true,
                        options: ['Active', 'Pending', 'Completed']
                    }
                ]
            });
            const formId = form.id;

            const promises = Array(500).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        Name: `User ${i}`,
                        Status: ['Active', 'Pending', 'Completed'][i % 3]
                    }
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(500);

            // Verify all submissions have correct data
            results.forEach((sub, i) => {
                expect(sub.data.Name).toBe(`User ${i}`);
                expect(['Active', 'Pending', 'Completed']).toContain(sub.data.Status);
            });

            expect(duration).toBeLessThan(30000);
            console.log(`✓ Created 500 submissions in ${duration}ms (avg: ${(duration / 500).toFixed(2)}ms per submission)`);
        }, 45000);

        test('should handle 1000 concurrent submissions with proper ID generation', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Bulk Submission Test 1000',
                questions: [
                    {
                        questionText: 'Name',
                        questionType: 'text',
                        required: true
                    },
                    {
                        questionText: 'Status',
                        questionType: 'select',
                        required: true,
                        options: ['Active', 'Pending', 'Completed']
                    }
                ]
            });
            const formId = form.id;

            const promises = Array(1000).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        Name: `User ${i}`,
                        Status: 'Active'
                    }
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(1000);

            // Verify unique IDs
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(1000);

            console.log(`✓ Created 1000 submissions in ${duration}ms (avg: ${(duration / 1000).toFixed(2)}ms per submission)`);
        }, 60000);
    });

    describe('Concurrent Submissions to Multiple Forms', () => {
        let formIds;

        beforeEach(async () => {
            if (!checkops) return;

            await pool.query('DELETE FROM submissions');
            await pool.query('DELETE FROM forms');
            await pool.query('DELETE FROM question_bank');
            await pool.query('DELETE FROM question_option_history');
            await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");

            // Create 10 different forms
            const promises = Array(10).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Form ${i}`,
                    questions: [{
                        questionText: 'Data',
                        questionType: 'text',
                        required: true
                    }]
                })
            );

            const forms = await Promise.all(promises);
            formIds = forms.map(f => f.id);
        });

        test('should handle submissions across multiple forms concurrently', async () => {
            if (!checkops) return;

            // 200 submissions spread across 10 forms
            const promises = Array(200).fill(null).map((_, i) => {
                const formId = formIds[i % 10];
                return checkops.createSubmission({
                    formId,
                    submissionData: {
                        Data: `Submission ${i} for form ${i % 10}`
                    }
                });
            });

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(200);

            // Verify submissions are correctly distributed
            const submissionsByForm = {};
            results.forEach(sub => {
                submissionsByForm[sub.formId] = (submissionsByForm[sub.formId] || 0) + 1;
            });

            // Each form should have 20 submissions
            Object.values(submissionsByForm).forEach(count => {
                expect(count).toBe(20);
            });

            console.log(`✓ Created 200 submissions across 10 forms in ${duration}ms`);
        }, 30000);
    });

    describe('Stats Computation Under Load', () => {
        beforeEach(async () => {
            if (!checkops) return;

            await pool.query('DELETE FROM submissions');
            await pool.query('DELETE FROM forms');
            await pool.query('DELETE FROM question_bank');
            await pool.query('DELETE FROM question_option_history');
            await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");
        });

        test('should compute correct stats for 500 submissions', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Stats Test',
                questions: [
                    {
                        questionText: 'Category',
                        questionType: 'select',
                        required: true,
                        options: ['A', 'B', 'C', 'D', 'E']
                    },
                    {
                        questionText: 'Tags',
                        questionType: 'multiselect',
                        required: true,
                        options: ['Tag1', 'Tag2', 'Tag3', 'Tag4']
                    }
                ]
            });
            const formId = form.id;

            // Create 500 submissions with varied data
            const promises = Array(500).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        Category: ['A', 'B', 'C', 'D', 'E'][i % 5],
                        Tags: [['Tag1'], ['Tag2'], ['Tag1', 'Tag2'], ['Tag3', 'Tag4'], ['Tag1', 'Tag3']][i % 5]
                    }
                })
            );

            await Promise.all(promises);

            // Compute stats
            const startTime = Date.now();
            const stats = await checkops.getSubmissionStats(formId);
            const duration = Date.now() - startTime;

            expect(stats.totalSubmissions).toBe(500);
            expect(stats.questions).toHaveLength(2);

            // Verify category stats (100 each)
            const categoryStats = stats.questions.find(q => q.questionText === 'Category');
            expect(categoryStats.stats.A).toBe(100);
            expect(categoryStats.stats.B).toBe(100);
            expect(categoryStats.stats.C).toBe(100);

            expect(duration).toBeLessThan(500);
            console.log(`✓ Computed stats for 500 submissions in ${duration}ms`);
        }, 30000);

        test('should handle concurrent submissions while computing stats', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Concurrent Stats Test',
                questions: [
                    {
                        questionText: 'Category',
                        questionType: 'select',
                        required: true,
                        options: ['A', 'B', 'C', 'D', 'E']
                    },
                    {
                        questionText: 'Tags',
                        questionType: 'multiselect',
                        required: true,
                        options: ['Tag1', 'Tag2', 'Tag3', 'Tag4']
                    }
                ]
            });
            const formId = form.id;

            // Create initial 100 submissions
            const initialPromises = Array(100).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        Category: 'A',
                        Tags: ['Tag1']
                    }
                })
            );
            await Promise.all(initialPromises);

            // Concurrently: add 100 more submissions AND compute stats multiple times
            const operations = [];

            // 100 more submissions
            for (let i = 0; i < 100; i++) {
                operations.push(
                    checkops.createSubmission({
                        formId,
                        submissionData: {
                            Category: 'B',
                            Tags: ['Tag2']
                        }
                    })
                );
            }

            // 20 concurrent stats computations
            for (let i = 0; i < 20; i++) {
                operations.push(checkops.getSubmissionStats(formId));
            }

            const results = await Promise.all(operations);

            // Verify submissions succeeded
            const submissions = results.filter(r => r.id && r.data);
            expect(submissions.length).toBe(100);

            // Verify stats were computed
            const statsResults = results.filter(r => r.totalSubmissions !== undefined);
            expect(statsResults.length).toBe(20);

            // Final stats should show 200 total
            const finalStats = await checkops.getSubmissionStats(formId);
            expect(finalStats.totalSubmissions).toBe(200);

            console.log('✓ Handled concurrent submissions and stats computations successfully');
        }, 40000);
    });

    describe('Performance Benchmarks', () => {
        beforeEach(async () => {
            if (!checkops) return;

            await pool.query('DELETE FROM submissions');
            await pool.query('DELETE FROM forms');
            await pool.query('DELETE FROM question_bank');
            await pool.query('DELETE FROM question_option_history');
            await pool.query("UPDATE id_counters SET current_value = 0 WHERE entity_type IN ('FORM', 'Q', 'SUB')");
        });

        test('should measure single submission creation latency', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Benchmark Form',
                questions: [{
                    questionText: 'Data',
                    questionType: 'text',
                    required: true
                }]
            });
            const formId = form.id;

            const iterations = 30;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await checkops.createSubmission({
                    formId,
                    submissionData: {
                        Data: `Test ${i}`
                    }
                });
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(`Submission Creation Performance:
  Average: ${avg.toFixed(2)}ms
  Min: ${min.toFixed(2)}ms
  Max: ${max.toFixed(2)}ms`);

            expect(avg).toBeLessThan(100); // 100ms target
        }, 15000);

        test('should measure stats computation latency', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Stats Benchmark Form',
                questions: [{
                    questionText: 'Data',
                    questionType: 'text',
                    required: true
                }]
            });
            const formId = form.id;

            // Create 200 submissions
            const promises = Array(200).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId,
                    submissionData: {
                        Data: `Entry ${i}`
                    }
                })
            );
            await Promise.all(promises);

            const iterations = 20;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await checkops.getSubmissionStats(formId);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(`Stats Computation Performance (200 submissions):
  Average: ${avg.toFixed(2)}ms
  Min: ${min.toFixed(2)}ms
  Max: ${max.toFixed(2)}ms`);

            expect(avg).toBeLessThan(300); // 300ms target for 200 submissions
        });
    });
});
