import { CheckOps } from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

describe('Load Testing: Concurrent Form Creation', () => {
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

    describe('Concurrent Form Creation', () => {
        test('should handle 50 concurrent form creates with unique IDs', async () => {
            if (!checkops) return;

            const promises = Array(50).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Load Test Form ${i}`,
                    description: `Testing concurrent creation ${i}`,
                    questions: [
                        {
                            questionText: `Question ${i}`,
                            questionType: 'text',
                            required: true
                        }
                    ]
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(50);
            expect(results.every(r => r.id)).toBe(true);

            // Verify all IDs are unique
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(50);

            // Performance: Should complete in reasonable time (< 10 seconds)
            expect(duration).toBeLessThan(10000);

            console.log(`✓ Created 50 forms in ${duration}ms (avg: ${(duration / 50).toFixed(2)}ms per form)`);
        }, 20000);

        test('should handle 100 concurrent form creates maintaining data integrity', async () => {
            if (!checkops) return;

            const promises = Array(100).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Bulk Form ${i}`,
                    questions: [
                        {
                            questionText: 'Name',
                            questionType: 'text',
                            required: true
                        },
                        {
                            questionText: 'Age',
                            questionType: 'number',
                            required: false
                        }
                    ]
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(100);

            // Verify data integrity
            for (let i = 0; i < results.length; i++) {
                expect(results[i].title).toBe(`Bulk Form ${i}`);
                expect(results[i].questions).toHaveLength(2);
                expect(results[i].id).toBeTruthy();
            }

            expect(duration).toBeLessThan(15000);
            console.log(`✓ Created 100 forms in ${duration}ms (avg: ${(duration / 100).toFixed(2)}ms per form)`);
        }, 30000);

        test('should handle concurrent forms with complex question sets', async () => {
            if (!checkops) return;

            const promises = Array(20).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Complex Form ${i}`,
                    questions: [
                        {
                            questionText: 'Select Status',
                            questionType: 'select',
                            required: true,
                            options: ['Draft', 'Review', 'Approved', 'Published']
                        },
                        {
                            questionText: 'Select Categories',
                            questionType: 'multiselect',
                            required: true,
                            options: ['Tech', 'Business', 'Design', 'Marketing', 'Sales']
                        },
                        {
                            questionText: 'Rating',
                            questionType: 'rating',
                            required: false,
                            maxRating: 5
                        },
                        {
                            questionText: 'Email',
                            questionType: 'email',
                            required: true
                        },
                        {
                            questionText: 'Description',
                            questionType: 'textarea',
                            required: false
                        }
                    ]
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(20);

            // Verify complex structures maintained
            results.forEach((form, i) => {
                expect(form.questions).toHaveLength(5);
                expect(form.questions[0].options).toHaveLength(4);
                expect(form.questions[1].options).toHaveLength(5);
            });

            console.log(`✓ Created 20 complex forms in ${duration}ms (avg: ${(duration / 20).toFixed(2)}ms per form)`);
        }, 25000);
    });

    describe('Form Retrieval Under Load', () => {
        let formIds;

        beforeEach(async () => {
            if (!checkops) return;

            // Create 30 forms for retrieval testing
            const promises = Array(30).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Retrieval Test Form ${i}`,
                    questions: [{
                        questionText: 'Test Question',
                        questionType: 'text'
                    }]
                })
            );

            const forms = await Promise.all(promises);
            formIds = forms.map(f => f.id);
        });

        test('should handle 100 concurrent form retrievals', async () => {
            if (!checkops) return;

            // Randomly retrieve forms (some will be duplicates)
            const promises = Array(100).fill(null).map(() => {
                const randomId = formIds[Math.floor(Math.random() * formIds.length)];
                return checkops.getForm(randomId);
            });

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(100);
            expect(results.every(r => r && r.id)).toBe(true);

            expect(duration).toBeLessThan(5000);
            console.log(`✓ Retrieved 100 forms in ${duration}ms (avg: ${(duration / 100).toFixed(2)}ms per retrieval)`);
        }, 15000);

        test('should handle mixed create and retrieve operations', async () => {
            if (!checkops) return;

            const operations = [];

            // Mix of creates and retrieves
            for (let i = 0; i < 50; i++) {
                if (i % 2 === 0) {
                    operations.push(
                        checkops.createForm({
                            title: `Mixed Op Form ${i}`,
                            questions: [{ questionText: 'Q', questionType: 'text' }]
                        })
                    );
                } else {
                    const randomId = formIds[Math.floor(Math.random() * formIds.length)];
                    operations.push(checkops.getForm(randomId));
                }
            }

            const startTime = Date.now();
            const results = await Promise.all(operations);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(50);
            expect(results.every(r => r && r.id)).toBe(true);

            console.log(`✓ Completed 50 mixed operations in ${duration}ms`);
        }, 20000);
    });

    describe('Performance Benchmarks', () => {
        test('should measure single form creation latency', async () => {
            if (!checkops) return;

            const iterations = 20;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await checkops.createForm({
                    title: `Benchmark ${i}`,
                    questions: [{ questionText: 'Q', questionType: 'text' }]
                });
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(`Form Creation Performance:
  Average: ${avg.toFixed(2)}ms
  Min: ${min.toFixed(2)}ms
  Max: ${max.toFixed(2)}ms`);

            expect(avg).toBeLessThan(200); // 200ms target
        }, 15000);

        test('should measure form retrieval latency', async () => {
            if (!checkops) return;

            // Create a test form
            const form = await checkops.createForm({
                title: 'Retrieval Benchmark',
                questions: [{ questionText: 'Test', questionType: 'text' }]
            });

            const iterations = 50;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await checkops.getForm(form.id);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(`Form Retrieval Performance:
  Average: ${avg.toFixed(2)}ms
  Min: ${min.toFixed(2)}ms
  Max: ${max.toFixed(2)}ms`);

            expect(avg).toBeLessThan(50); // 50ms target
        });
    });
});
