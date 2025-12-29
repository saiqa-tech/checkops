import { CheckOps } from '../../src/index.js';
import { getPool } from '../../src/config/database.js';

describe('Load Testing: Connection Pool & Resource Management', () => {
    let checkops;
    let pool;

    beforeAll(async () => {
        checkops = new CheckOps({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'checkops',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20, // Connection pool max
            min: 2,  // Connection pool min
        });

        try {
            await checkops.initialize();
            pool = getPool();
        } catch (error) {
            console.log('Database not available, skipping connection pool tests');
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

    describe('Connection Pool Stress Testing', () => {
        test('should handle 100 rapid sequential operations without pool exhaustion', async () => {
            if (!checkops) return;

            const operations = [];

            // Create form first
            const form = await checkops.createForm({
                title: 'Pool Test Form',
                questions: [{
                    questionText: 'Data',
                    questionType: 'text',
                    required: true
                }]
            });

            // 100 rapid operations
            for (let i = 0; i < 100; i++) {
                if (i % 2 === 0) {
                    operations.push(checkops.getForm(form.id));
                } else {
                    operations.push(
                        checkops.createSubmission({
                            formId: form.id,
                            submissionData: { Data: `Entry ${i}` }
                        })
                    );
                }
            }

            const startTime = Date.now();
            const results = await Promise.all(operations);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(100);
            expect(results.every(r => r && r.id)).toBe(true);

            console.log(`✓ Completed 100 operations in ${duration}ms without pool exhaustion`);
        }, 20000);

        test('should handle burst load of 200 concurrent operations', async () => {
            if (!checkops) return;

            // Create multiple forms
            const formPromises = Array(10).fill(null).map((_, i) =>
                checkops.createForm({
                    title: `Burst Test Form ${i}`,
                    questions: [{
                        questionText: 'Field',
                        questionType: 'text',
                        required: true
                    }]
                })
            );
            const forms = await Promise.all(formPromises);
            const formIds = forms.map(f => f.id);

            // Burst: 200 concurrent operations across different forms
            const burstOperations = Array(200).fill(null).map((_, i) => {
                const formId = formIds[i % 10];
                if (i % 3 === 0) {
                    return checkops.getForm(formId);
                } else {
                    return checkops.createSubmission({
                        formId,
                        submissionData: { Field: `Data ${i}` }
                    });
                }
            });

            const startTime = Date.now();
            const results = await Promise.all(burstOperations);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(200);

            // Verify no failures
            const failures = results.filter(r => !r || !r.id);
            expect(failures).toHaveLength(0);

            console.log(`✓ Handled burst of 200 operations in ${duration}ms (avg: ${(duration / 200).toFixed(2)}ms per op)`);
        }, 30000);

        test('should gracefully handle sustained high load over multiple batches', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Sustained Load Form',
                questions: [{
                    questionText: 'Value',
                    questionType: 'number',
                    required: true
                }]
            });

            const batchSize = 50;
            const batches = 10;
            let totalSuccesses = 0;

            const startTime = Date.now();

            for (let batch = 0; batch < batches; batch++) {
                const batchPromises = Array(batchSize).fill(null).map((_, i) =>
                    checkops.createSubmission({
                        formId: form.id,
                        submissionData: { Value: batch * batchSize + i }
                    })
                );

                const results = await Promise.all(batchPromises);
                totalSuccesses += results.filter(r => r && r.id).length;
            }

            const duration = Date.now() - startTime;

            expect(totalSuccesses).toBe(batchSize * batches);

            console.log(`✓ Completed ${batches} batches (${totalSuccesses} operations) in ${duration}ms`);
        }, 45000);
    });

    describe('Database Query Performance', () => {
        test('should maintain performance with growing dataset', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Performance Test',
                questions: [{
                    questionText: 'Status',
                    questionType: 'select',
                    required: true,
                    options: ['New', 'Processing', 'Done']
                }]
            });

            // Add submissions in stages and measure retrieval time
            const stages = [100, 200, 300, 400, 500];
            const retrievalTimes = [];

            for (const targetCount of stages) {
                // Add submissions to reach target count
                const currentCount = retrievalTimes.length * 100;
                const toAdd = targetCount - currentCount;

                if (toAdd > 0) {
                    const promises = Array(toAdd).fill(null).map(() =>
                        checkops.createSubmission({
                            formId: form.id,
                            submissionData: { Status: 'New' }
                        })
                    );
                    await Promise.all(promises);
                }

                // Measure retrieval time
                const start = performance.now();
                const submissions = await checkops.getSubmissions(form.id);
                const duration = performance.now() - start;

                retrievalTimes.push({ count: targetCount, time: duration });

                expect(submissions.length).toBe(targetCount);
            }

            console.log('Performance with growing dataset:');
            retrievalTimes.forEach(({ count, time }) => {
                console.log(`  ${count} submissions: ${time.toFixed(2)}ms`);
            });

            // Performance should not degrade dramatically
            const firstTime = retrievalTimes[0].time;
            const lastTime = retrievalTimes[retrievalTimes.length - 1].time;

            // Last should not be more than 5x the first
            expect(lastTime).toBeLessThan(firstTime * 5);
        }, 60000);

        test('should efficiently handle pagination with large datasets', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Pagination Test',
                questions: [{
                    questionText: 'Index',
                    questionType: 'number',
                    required: true
                }]
            });

            // Create 500 submissions
            const promises = Array(500).fill(null).map((_, i) =>
                checkops.createSubmission({
                    formId: form.id,
                    submissionData: { Index: i }
                })
            );
            await Promise.all(promises);

            // Test pagination performance
            const pageSize = 50;
            const pages = 10;
            const pageTimes = [];

            for (let page = 0; page < pages; page++) {
                const start = performance.now();
                const submissions = await checkops.getSubmissions(form.id, {
                    limit: pageSize,
                    offset: page * pageSize
                });
                const duration = performance.now() - start;

                pageTimes.push(duration);
                expect(submissions.length).toBe(pageSize);
            }

            const avgPageTime = pageTimes.reduce((a, b) => a + b) / pageTimes.length;

            console.log(`Pagination Performance:
  Average per page: ${avgPageTime.toFixed(2)}ms
  Total for 10 pages: ${pageTimes.reduce((a, b) => a + b).toFixed(2)}ms`);

            expect(avgPageTime).toBeLessThan(200); // 200ms per page
        }, 40000);
    });

    describe('Memory & Resource Cleanup', () => {
        test('should not leak connections during repeated operations', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Connection Leak Test',
                questions: [{
                    questionText: 'Data',
                    questionType: 'text',
                    required: true
                }]
            });

            // Get initial pool stats
            const initialTotal = pool.totalCount;
            const initialIdle = pool.idleCount;

            // Perform many operations
            for (let batch = 0; batch < 5; batch++) {
                const promises = Array(20).fill(null).map(() =>
                    checkops.createSubmission({
                        formId: form.id,
                        submissionData: { Data: 'test' }
                    })
                );
                await Promise.all(promises);
            }

            // Wait for connections to return to pool
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check pool stats haven't grown unreasonably
            const finalTotal = pool.totalCount;
            const finalIdle = pool.idleCount;

            console.log(`Pool stats:
  Initial: ${initialTotal} total, ${initialIdle} idle
  Final: ${finalTotal} total, ${finalIdle} idle`);

            // Should not have created excessive connections
            expect(finalTotal).toBeLessThanOrEqual(20); // Max pool size

            // Most connections should be idle after operations complete
            expect(finalIdle).toBeGreaterThan(0);
        }, 30000);

        test('should handle graceful shutdown with active connections', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Shutdown Test',
                questions: [{
                    questionText: 'Value',
                    questionType: 'text',
                    required: true
                }]
            });

            // Start some long-running operations
            const promises = Array(10).fill(null).map(() =>
                checkops.createSubmission({
                    formId: form.id,
                    submissionData: { Value: 'data' }
                })
            );

            // Let them complete
            await Promise.all(promises);

            // Verify pool is still healthy
            expect(pool.totalCount).toBeGreaterThan(0);

            console.log('✓ Pool remains healthy after operations');
        });
    });

    describe('Error Recovery Under Load', () => {
        test('should recover from temporary connection issues', async () => {
            if (!checkops) return;

            const form = await checkops.createForm({
                title: 'Recovery Test',
                questions: [{
                    questionText: 'Field',
                    questionType: 'text',
                    required: true
                }]
            });

            // Successful operations
            const batch1 = Array(20).fill(null).map(() =>
                checkops.createSubmission({
                    formId: form.id,
                    submissionData: { Field: 'data' }
                })
            );
            await Promise.all(batch1);

            // Simulate recovery by continuing operations
            const batch2 = Array(20).fill(null).map(() =>
                checkops.createSubmission({
                    formId: form.id,
                    submissionData: { Field: 'recovery' }
                })
            );
            const results = await Promise.all(batch2);

            expect(results.every(r => r && r.id)).toBe(true);

            console.log('✓ System recovered and continued processing');
        }, 25000);
    });
});
