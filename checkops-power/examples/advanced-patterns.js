/**
 * Advanced CheckOps Patterns Example
 */

import { CheckOpsWrapper, FormBuilder, ValidationHelpers, DataHelpers } from '../lib/index.js';
import EventEmitter from 'events';
import dotenv from 'dotenv';

dotenv.config();

class AdvancedCheckOpsService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.checkops = new CheckOpsWrapper({
            enableLogging: true,
            enableMetrics: true,
            ...config,
        });

        this.formCache = new Map();
        this.submissionQueue = [];
        this.processingQueue = false;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.checkops.on('formCreated', (form) => {
            this.formCache.set(form.id, form);
            this.emit('formCached', form);
        });

        this.checkops.on('submissionCreated', (submission) => {
            this.emit('submissionProcessed', submission);
        });
    }

    async initialize() {
        await this.checkops.initialize();
        this.checkops.enableCache();
        this.startQueueProcessor();
    }

    // Advanced form creation with validation
    async createValidatedForm(formData, validationRules = {}) {
        try {
            // Custom validation
            if (validationRules.maxQuestions && formData.questions.length > validationRules.maxQuestions) {
                throw new Error(`Form cannot have more than ${validationRules.maxQuestions} questions`);
            }

            if (validationRules.requiredFields) {
                const missingFields = validationRules.requiredFields.filter(field => !formData[field]);
                if (missingFields.length > 0) {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }
            }

            // Transform and normalize data
            const transformedData = DataHelpers.transformFormData(formData);

            const form = await this.checkops.createForm(transformedData);

            // Post-creation processing
            if (validationRules.autoActivate !== false) {
                await this.activateForm(form.id);
            }

            return form;
        } catch (error) {
            this.emit('formCreationError', { formData, error });
            throw error;
        }
    }

    // Queue-based submission processing
    async queueSubmission(submissionData, priority = 'normal') {
        const queueItem = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            submissionData,
            priority,
            timestamp: new Date(),
            retries: 0,
            maxRetries: 3,
        };

        this.submissionQueue.push(queueItem);
        this.emit('submissionQueued', queueItem);

        // Sort by priority
        this.submissionQueue.sort((a, b) => {
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        return queueItem.id;
    }

    async startQueueProcessor() {
        if (this.processingQueue) return;

        this.processingQueue = true;

        while (this.processingQueue) {
            if (this.submissionQueue.length > 0) {
                const item = this.submissionQueue.shift();

                try {
                    const submission = await this.checkops.createSubmission(item.submissionData);
                    this.emit('queueItemProcessed', { item, submission });
                } catch (error) {
                    item.retries++;

                    if (item.retries < item.maxRetries) {
                        // Re-queue with delay
                        setTimeout(() => {
                            this.submissionQueue.push(item);
                        }, 1000 * item.retries);

                        this.emit('queueItemRetry', { item, error });
                    } else {
                        this.emit('queueItemFailed', { item, error });
                    }
                }
            }

            // Wait before next iteration
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Advanced analytics with custom metrics
    async getAdvancedAnalytics(formId, options = {}) {
        const stats = await this.checkops.getStats(formId);
        const submissions = await this.checkops.getSubmissions(formId, {
            limit: options.limit || 1000,
            offset: 0,
        });

        const analytics = {
            basic: stats,
            advanced: {
                submissionTrends: this.calculateSubmissionTrends(submissions),
                responseQuality: this.analyzeResponseQuality(submissions),
                completionRates: this.calculateCompletionRates(submissions),
                timeAnalysis: this.analyzeResponseTimes(submissions),
            },
        };

        if (options.includeSegmentation) {
            analytics.advanced.segmentation = this.segmentResponses(submissions);
        }

        return analytics;
    }

    calculateSubmissionTrends(submissions) {
        const trends = {};
        const now = new Date();
        const periods = ['24h', '7d', '30d'];

        periods.forEach(period => {
            const cutoff = new Date();
            switch (period) {
                case '24h':
                    cutoff.setHours(cutoff.getHours() - 24);
                    break;
                case '7d':
                    cutoff.setDate(cutoff.getDate() - 7);
                    break;
                case '30d':
                    cutoff.setDate(cutoff.getDate() - 30);
                    break;
            }

            trends[period] = submissions.filter(sub =>
                new Date(sub.createdAt) >= cutoff
            ).length;
        });

        return trends;
    }

    analyzeResponseQuality(submissions) {
        let totalFields = 0;
        let completedFields = 0;
        let qualityScore = 0;

        submissions.forEach(submission => {
            const data = submission.submissionData;
            const fields = Object.keys(data);

            totalFields += fields.length;

            fields.forEach(field => {
                const value = data[field];
                if (value !== null && value !== undefined && value !== '') {
                    completedFields++;

                    // Quality scoring based on response length and type
                    if (typeof value === 'string' && value.length > 10) {
                        qualityScore += 2;
                    } else if (value) {
                        qualityScore += 1;
                    }
                }
            });
        });

        return {
            completionRate: totalFields > 0 ? (completedFields / totalFields) * 100 : 0,
            averageQualityScore: submissions.length > 0 ? qualityScore / submissions.length : 0,
            totalResponses: submissions.length,
        };
    }

    calculateCompletionRates(submissions) {
        // This would require form structure to calculate properly
        // For now, return basic completion metrics
        return {
            started: submissions.length,
            completed: submissions.filter(sub =>
                Object.keys(sub.submissionData).length > 0
            ).length,
        };
    }

    analyzeResponseTimes(submissions) {
        // This would require timestamp data for when users started vs completed
        // For now, return submission frequency analysis
        const timeDistribution = {};

        submissions.forEach(submission => {
            const hour = new Date(submission.createdAt).getHours();
            timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
        });

        return {
            hourlyDistribution: timeDistribution,
            peakHour: Object.entries(timeDistribution)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
        };
    }

    segmentResponses(submissions) {
        // Example segmentation by response patterns
        const segments = {
            highEngagement: [],
            mediumEngagement: [],
            lowEngagement: [],
        };

        submissions.forEach(submission => {
            const responseCount = Object.keys(submission.submissionData).length;
            const responseLength = Object.values(submission.submissionData)
                .join('').length;

            if (responseCount >= 5 && responseLength > 100) {
                segments.highEngagement.push(submission.id);
            } else if (responseCount >= 3 || responseLength > 50) {
                segments.mediumEngagement.push(submission.id);
            } else {
                segments.lowEngagement.push(submission.id);
            }
        });

        return segments;
    }

    // Form A/B testing support
    async createABTest(baseFormData, variations, testConfig = {}) {
        const testId = `test_${Date.now()}`;
        const forms = {};

        // Create control form
        const controlForm = await this.createValidatedForm({
            ...baseFormData,
            title: `${baseFormData.title} (Control)`,
            metadata: {
                ...baseFormData.metadata,
                abTest: testId,
                variant: 'control',
            },
        });
        forms.control = controlForm;

        // Create variation forms
        for (const [variantName, variantData] of Object.entries(variations)) {
            const variantForm = await this.createValidatedForm({
                ...baseFormData,
                ...variantData,
                title: `${baseFormData.title} (${variantName})`,
                metadata: {
                    ...baseFormData.metadata,
                    ...variantData.metadata,
                    abTest: testId,
                    variant: variantName,
                },
            });
            forms[variantName] = variantForm;
        }

        const abTest = {
            id: testId,
            forms,
            config: {
                trafficSplit: testConfig.trafficSplit || 'equal',
                duration: testConfig.duration || '7d',
                startDate: new Date(),
                ...testConfig,
            },
        };

        this.emit('abTestCreated', abTest);
        return abTest;
    }

    // Smart form routing for A/B tests
    getFormForUser(abTest, userId) {
        const variants = Object.keys(abTest.forms);
        const hash = this.hashUserId(userId);
        const variantIndex = hash % variants.length;

        return abTest.forms[variants[variantIndex]];
    }

    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    async activateForm(formId) {
        // Custom activation logic
        this.emit('formActivated', { formId, timestamp: new Date() });
    }

    async close() {
        this.processingQueue = false;
        await this.checkops.close();
    }
}

/**
 * Runs an end-to-end demonstration of AdvancedCheckOpsService features and workflows.
 *
 * Initializes the service, creates a validated form, enqueues and processes submissions with prioritization and retries,
 * creates an A/B test and demonstrates deterministic routing, generates advanced analytics (optionally segmented),
 * logs progress and events to the console, and performs a clean shutdown.
 */
async function advancedPatternsExample() {
    console.log('🚀 CheckOps Advanced Patterns Example');
    console.log('=====================================\n');

    const service = new AdvancedCheckOpsService();

    // Set up event listeners
    service.on('formCached', (form) => {
        console.log(`📋 Form cached: ${form.title}`);
    });

    service.on('submissionQueued', (item) => {
        console.log(`📝 Submission queued: ${item.id} (priority: ${item.priority})`);
    });

    service.on('queueItemProcessed', ({ item, submission }) => {
        console.log(`✅ Queue item processed: ${item.id} -> ${submission.id}`);
    });

    service.on('abTestCreated', (abTest) => {
        console.log(`🧪 A/B test created: ${abTest.id} with ${Object.keys(abTest.forms).length} variants`);
    });

    try {
        await service.initialize();

        // Example 1: Advanced form creation with validation
        console.log('📋 Creating validated form...');
        const advancedForm = await service.createValidatedForm(
            new FormBuilder()
                .title('Advanced Survey')
                .description('A comprehensive survey with validation')
                .textQuestion('Name', true)
                .emailQuestion('Email', true)
                .ratingQuestion('Satisfaction', [1, 2, 3, 4, 5], true)
                .textareaQuestion('Comments')
                .build(),
            {
                maxQuestions: 10,
                requiredFields: ['title', 'description'],
                autoActivate: true,
            }
        );

        // Example 2: Queue-based submission processing
        console.log('\n📦 Queuing submissions...');
        await service.queueSubmission({
            formId: advancedForm.id,
            submissionData: {
                'Name': 'Alice Johnson',
                'Email': 'alice@example.com',
                'Satisfaction': 5,
                'Comments': 'Excellent service!',
            },
        }, 'high');

        await service.queueSubmission({
            formId: advancedForm.id,
            submissionData: {
                'Name': 'Bob Smith',
                'Email': 'bob@example.com',
                'Satisfaction': 4,
                'Comments': 'Good overall experience.',
            },
        }, 'normal');

        // Wait for queue processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Example 3: A/B Testing
        console.log('\n🧪 Creating A/B test...');
        const abTest = await service.createABTest(
            new FormBuilder()
                .title('Product Feedback')
                .description('Help us improve our product')
                .ratingQuestion('Overall Rating', [1, 2, 3, 4, 5], true)
                .textareaQuestion('Suggestions')
                .build(),
            {
                shortForm: {
                    questions: [
                        {
                            questionText: 'Rate our product',
                            questionType: 'rating',
                            options: [1, 2, 3, 4, 5],
                            required: true,
                        },
                    ],
                },
                detailedForm: {
                    questions: [
                        {
                            questionText: 'Overall Rating',
                            questionType: 'rating',
                            options: [1, 2, 3, 4, 5],
                            required: true,
                        },
                        {
                            questionText: 'What do you like most?',
                            questionType: 'textarea',
                            required: false,
                        },
                        {
                            questionText: 'What could be improved?',
                            questionType: 'textarea',
                            required: false,
                        },
                        {
                            questionText: 'Would you recommend us?',
                            questionType: 'boolean',
                            required: true,
                        },
                    ],
                },
            },
            {
                duration: '14d',
                trafficSplit: 'equal',
            }
        );

        // Example 4: Smart form routing
        console.log('\n🎯 Testing form routing...');
        const user1Form = service.getFormForUser(abTest, 'user123');
        const user2Form = service.getFormForUser(abTest, 'user456');
        console.log(`User 1 gets variant: ${user1Form.metadata.variant}`);
        console.log(`User 2 gets variant: ${user2Form.metadata.variant}`);

        // Example 5: Advanced analytics
        console.log('\n📊 Generating advanced analytics...');

        // Add some test submissions first
        await service.queueSubmission({
            formId: advancedForm.id,
            submissionData: {
                'Name': 'Charlie Brown',
                'Email': 'charlie@example.com',
                'Satisfaction': 3,
                'Comments': 'Average experience.',
            },
        });

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        const analytics = await service.getAdvancedAnalytics(advancedForm.id, {
            includeSegmentation: true,
            limit: 100,
        });

        console.log('Analytics summary:');
        console.log(`- Total submissions: ${analytics.basic.totalSubmissions}`);
        console.log(`- Response quality: ${analytics.advanced.responseQuality.averageQualityScore.toFixed(2)}`);
        console.log(`- Completion rate: ${analytics.advanced.responseQuality.completionRate.toFixed(1)}%`);
        console.log(`- High engagement responses: ${analytics.advanced.segmentation.highEngagement.length}`);

        console.log('\n🎉 Advanced patterns example completed successfully!');

    } catch (error) {
        console.error('❌ Example failed:', error.message);
    } finally {
        await service.close();
    }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    advancedPatternsExample();
}

export { AdvancedCheckOpsService, advancedPatternsExample };