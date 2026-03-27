/**
 * Findings Integration Tests
 * Tests the complete Finding workflow including CRUD operations
 */

import CheckOps from '../../src/index.js';
import { getPool } from '../../src/config/database.js';
import { cleanupAllTestData } from '../helpers/cleanup.js';

describe('Findings Integration Tests', () => {
    let checkops;
    let pool;
    let testForm;
    let testSubmission;
    let testQuestion;

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
            console.log('Database not available, skipping findings tests');
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

        // Clean up test data
        await cleanupAllTestData(checkops);

        // Create test form with question
        testForm = await checkops.createForm({
            title: 'Test Audit Form',
            description: 'Form for testing findings',
            questions: [
                {
                    questionText: 'Is equipment properly maintained?',
                    questionType: 'boolean',
                    required: true,
                    metadata: {}
                }
            ],
            metadata: {}
        });

        testQuestion = testForm.questions[0];

        // Create test submission using the question UUID as key
        testSubmission = await checkops.createSubmission({
            formId: testForm.id,
            submissionData: {
                [testQuestion.id]: 'No'  // Use question UUID (id) as key
            },
            metadata: {}
        });
    });

    describe('createFinding', () => {
        test('should create finding with all fields', async () => {
            if (!checkops) return;

            const finding = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Major',
                department: 'Operations',
                observation: 'Equipment not cleaned properly',
                rootCause: 'Staff did not follow SOP',
                evidenceUrls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
                assignment: [
                    { user_id: 'user-1', user_name: 'John Doe' },
                    { user_id: 'user-2', user_name: 'Jane Smith' }
                ],
                status: 'open',
                metadata: { location: 'Store #123' },
                createdBy: 'auditor@example.com'
            });

            expect(finding).toBeDefined();
            expect(finding.sid).toMatch(/^FND-\d{3}$/);
            expect(finding.severity).toBe('Major');
            expect(finding.department).toBe('Operations');
            expect(finding.observation).toBe('Equipment not cleaned properly');
            expect(finding.rootCause).toBe('Staff did not follow SOP');
            expect(finding.evidenceUrls).toHaveLength(2);
            expect(finding.assignment).toHaveLength(2);
            expect(finding.status).toBe('open');
            expect(finding.metadata.location).toBe('Store #123');
            expect(finding.createdBy).toBe('auditor@example.com');
        });

        test('should create finding with minimal fields', async () => {
            if (!checkops) return;

            const finding = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id               // Use UUID
            });

            expect(finding).toBeDefined();
            expect(finding.sid).toMatch(/^FND-\d{3}$/);
            expect(finding.severity).toBeNull();
            expect(finding.department).toBeNull();
            expect(finding.observation).toBeNull();
            expect(finding.assignment).toEqual([]);
            expect(finding.metadata).toEqual({});
        });
    });

    describe('getFinding', () => {
        test('should get finding by UUID', async () => {
            if (!checkops) return;

            const created = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Critical',
                observation: 'Test observation'
            });

            const found = await checkops.getFinding(created.id);

            expect(found).toBeDefined();
            expect(found.sid).toBe(created.sid);
            expect(found.severity).toBe('Critical');
            expect(found.observation).toBe('Test observation');
        });

        test('should get finding by UUID', async () => {
            if (!checkops) return;

            const created = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Minor'
            });

            const found = await checkops.getFinding(created.id);

            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
            expect(found.sid).toBe(created.sid);
        });
    });

    describe('getFindingsByForm', () => {
        test('should get all findings for a form', async () => {
            if (!checkops) return;

            await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Major'
            });

            await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Minor'
            });

            const findings = await checkops.getFindingsByForm(testForm.id);

            expect(findings).toHaveLength(2);
            expect(findings[0].formId).toBe(testForm.id);
            expect(findings[1].formId).toBe(testForm.id);
        });
    });

    describe('updateFinding', () => {
        test('should update finding fields', async () => {
            if (!checkops) return;

            const finding = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id,              // Use UUID
                severity: 'Major',
                status: 'open'
            });

            const updated = await checkops.updateFinding(finding.id, {
                severity: 'Critical',
                status: 'in_progress',
                rootCause: 'Updated root cause'
            });

            expect(updated.sid).toBe(finding.sid);
            expect(updated.severity).toBe('Critical');
            expect(updated.status).toBe('in_progress');
            expect(updated.rootCause).toBe('Updated root cause');
        });
    });

    describe('deleteFinding', () => {
        test('should delete finding by UUID', async () => {
            if (!checkops) return;

            const finding = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id               // Use UUID
            });

            const deleted = await checkops.deleteFinding(finding.id);

            expect(deleted.id).toBe(finding.id);

            await expect(
                checkops.getFinding(finding.id)
            ).rejects.toThrow('not found');
        });
    });

    describe('cascade delete', () => {
        test('should delete findings when form is deleted', async () => {
            if (!checkops) return;

            const finding = await checkops.createFinding({
                submissionId: testSubmission.id,  // Use UUID
                questionId: testQuestion.id,      // Use UUID
                formId: testForm.id               // Use UUID
            });

            await checkops.deleteForm(testForm.id);

            await expect(
                checkops.getFinding(finding.id)
            ).rejects.toThrow('not found');
        });
    });
});
