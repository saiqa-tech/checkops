#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import CheckOps, {
    productionMetrics,
    metricsCollector,
    withMonitoring,
    recordBatchOperation
} from '@saiqa-tech/checkops';

class CheckOpsMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'checkops-tools',
                version: '3.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.checkops = null;
        this.monitoringEnabled = false;
        this.setupToolHandlers();
    }

    async initializeCheckOps() {
        if (this.checkops) return this.checkops;

        try {
            this.checkops = new CheckOps({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
            });

            await this.checkops.initialize();

            // Enable monitoring if requested
            if (process.env.ENABLE_MONITORING === 'true') {
                this.enableMonitoring();
            }

            return this.checkops;
        } catch (error) {
            // Provide more specific error information
            const errorMessage = error.code
                ? `Failed to initialize CheckOps (${error.code}): ${error.message}`
                : `Failed to initialize CheckOps: ${error.message}`;
            throw new Error(errorMessage);
        }
    }

    enableMonitoring() {
        if (!this.monitoringEnabled) {
            productionMetrics.startMonitoring(60000); // 1 minute intervals
            this.monitoringEnabled = true;
        }
    }

    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'checkops_test_connection',
                    description: 'Test database connection for CheckOps',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'checkops_create_form',
                    description: 'Create a new form with questions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Form title' },
                            description: { type: 'string', description: 'Form description' },
                            questions: {
                                type: 'array',
                                description: 'Array of questions',
                                items: {
                                    type: 'object',
                                    properties: {
                                        questionText: { type: 'string' },
                                        questionType: { type: 'string' },
                                        required: { type: 'boolean' },
                                        options: { type: 'array' },
                                    },
                                },
                            },
                        },
                        required: ['title', 'questions'],
                    },
                },
                {
                    name: 'checkops_get_forms',
                    description: 'Get all forms or specific form by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Optional form ID' },
                            limit: { type: 'number', description: 'Limit results' },
                            offset: { type: 'number', description: 'Offset for pagination' },
                        },
                    },
                },
                {
                    name: 'checkops_create_submission',
                    description: 'Create a submission for a form',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            formId: { type: 'string', description: 'Form ID' },
                            submissionData: {
                                type: 'object',
                                description: 'Submission data as key-value pairs',
                            },
                        },
                        required: ['formId', 'submissionData'],
                    },
                },
                {
                    name: 'checkops_get_submissions',
                    description: 'Get submissions for a form',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            formId: { type: 'string', description: 'Form ID' },
                            limit: { type: 'number', description: 'Limit results' },
                            offset: { type: 'number', description: 'Offset for pagination' },
                        },
                        required: ['formId'],
                    },
                },
                {
                    name: 'checkops_get_stats',
                    description: 'Get submission statistics for a form',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            formId: { type: 'string', description: 'Form ID' },
                        },
                        required: ['formId'],
                    },
                },
                {
                    name: 'checkops_create_question',
                    description: 'Create a reusable question',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            questionText: { type: 'string', description: 'Question text' },
                            questionType: { type: 'string', description: 'Question type' },
                            options: { type: 'array', description: 'Question options' },
                            validationRules: { type: 'object', description: 'Validation rules' },
                        },
                        required: ['questionText', 'questionType'],
                    },
                },
                {
                    name: 'checkops_get_questions',
                    description: 'Get all questions or specific question by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Optional question ID' },
                            limit: { type: 'number', description: 'Limit results' },
                            offset: { type: 'number', description: 'Offset for pagination' },
                        },
                    },
                },
                // NEW v3.0.0 PERFORMANCE MONITORING TOOLS
                {
                    name: 'checkops_start_monitoring',
                    description: 'Start real-time performance monitoring with configurable intervals',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            intervalMs: {
                                type: 'number',
                                description: 'Monitoring interval in milliseconds (default: 60000)',
                                default: 60000
                            },
                        },
                    },
                },
                {
                    name: 'checkops_get_metrics',
                    description: 'Get comprehensive performance metrics and statistics',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            format: {
                                type: 'string',
                                description: 'Output format: json or text',
                                enum: ['json', 'text'],
                                default: 'json'
                            },
                        },
                    },
                },
                {
                    name: 'checkops_get_health_status',
                    description: 'Get system health status with detailed assessment',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'checkops_get_performance_trends',
                    description: 'Get performance trends and historical analysis',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            timeRangeMinutes: {
                                type: 'number',
                                description: 'Time range in minutes for trend analysis',
                                default: 60
                            },
                        },
                    },
                },
                // NEW v3.0.0 BATCH OPERATIONS
                {
                    name: 'checkops_bulk_create_forms',
                    description: 'Create multiple forms in a single optimized operation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            forms: {
                                type: 'array',
                                description: 'Array of form objects to create',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        description: { type: 'string' },
                                        questions: { type: 'array' },
                                        metadata: { type: 'object' },
                                    },
                                    required: ['title', 'questions'],
                                },
                            },
                        },
                        required: ['forms'],
                    },
                },
                {
                    name: 'checkops_bulk_create_submissions',
                    description: 'Create multiple submissions for a form in a single operation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            formId: { type: 'string', description: 'Form ID' },
                            submissions: {
                                type: 'array',
                                description: 'Array of submission data objects',
                                items: {
                                    type: 'object',
                                    description: 'Submission data as key-value pairs',
                                },
                            },
                        },
                        required: ['formId', 'submissions'],
                    },
                },
                {
                    name: 'checkops_bulk_create_questions',
                    description: 'Create multiple reusable questions in a single operation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            questions: {
                                type: 'array',
                                description: 'Array of question objects to create',
                                items: {
                                    type: 'object',
                                    properties: {
                                        questionText: { type: 'string' },
                                        questionType: { type: 'string' },
                                        options: { type: 'array' },
                                        validationRules: { type: 'object' },
                                    },
                                    required: ['questionText', 'questionType'],
                                },
                            },
                        },
                        required: ['questions'],
                    },
                },
                // NEW v3.0.0 CACHE MANAGEMENT
                {
                    name: 'checkops_get_cache_stats',
                    description: 'Get comprehensive cache statistics and performance metrics',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    name: 'checkops_clear_cache',
                    description: 'Clear cache for specific items or all cached data',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                                description: 'Cache type to clear: form, question, stats, submission, or all',
                                enum: ['form', 'question', 'stats', 'submission', 'all'],
                                default: 'all'
                            },
                            id: {
                                type: 'string',
                                description: 'Specific ID to clear (optional, clears all if not provided)'
                            },
                        },
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                const checkops = await this.initializeCheckOps();

                // Route to appropriate handler based on tool category
                if (['checkops_start_monitoring', 'checkops_get_metrics', 'checkops_get_health_status', 'checkops_get_performance_trends'].includes(name)) {
                    return await this.handleMonitoringTools(name, args, checkops);
                }

                if (['checkops_bulk_create_forms', 'checkops_bulk_create_submissions', 'checkops_bulk_create_questions'].includes(name)) {
                    return await this.handleBatchOperations(name, args, checkops);
                }

                if (['checkops_get_cache_stats', 'checkops_clear_cache'].includes(name)) {
                    return await this.handleCacheOperations(name, args, checkops);
                }

                // Original v2.x.x tools
                switch (name) {
                    case 'checkops_test_connection':
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: 'Database connection successful! CheckOps is ready to use.',
                                },
                            ],
                        };

                    case 'checkops_create_form':
                        const form = await checkops.createForm(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Form created successfully with ID: ${form.id}`,
                                },
                                {
                                    type: 'text',
                                    text: JSON.stringify(form, null, 2),
                                },
                            ],
                        };

                    case 'checkops_get_forms':
                        if (args.id) {
                            const form = await checkops.getForm(args.id);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(form, null, 2),
                                    },
                                ],
                            };
                        } else {
                            const forms = await checkops.getAllForms(args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(forms, null, 2),
                                    },
                                ],
                            };
                        }

                    case 'checkops_create_submission':
                        const submission = await checkops.createSubmission(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Submission created successfully with ID: ${submission.id}`,
                                },
                                {
                                    type: 'text',
                                    text: JSON.stringify(submission, null, 2),
                                },
                            ],
                        };

                    case 'checkops_get_submissions':
                        const submissions = await checkops.getSubmissionsByForm(
                            args.formId,
                            { limit: args.limit, offset: args.offset }
                        );
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(submissions, null, 2),
                                },
                            ],
                        };

                    case 'checkops_get_stats':
                        const stats = await checkops.getSubmissionStats(args.formId);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(stats, null, 2),
                                },
                            ],
                        };

                    case 'checkops_create_question':
                        const question = await checkops.createQuestion(args);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Question created successfully with ID: ${question.id}`,
                                },
                                {
                                    type: 'text',
                                    text: JSON.stringify(question, null, 2),
                                },
                            ],
                        };

                    case 'checkops_get_questions':
                        if (args.id) {
                            const question = await checkops.getQuestion(args.id);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(question, null, 2),
                                    },
                                ],
                            };
                        } else {
                            const questions = await checkops.getAllQuestions(args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(questions, null, 2),
                                    },
                                ],
                            };
                        }

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    // NEW v3.0.0 TOOL HANDLERS
    async handleMonitoringTools(name, args, checkops) {
        switch (name) {
            case 'checkops_start_monitoring':
                this.enableMonitoring();
                if (args.intervalMs) {
                    productionMetrics.startMonitoring(args.intervalMs);
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Performance monitoring started with ${args.intervalMs || 60000}ms intervals`,
                        },
                    ],
                };

            case 'checkops_get_metrics':
                const metrics = productionMetrics.exportMetricsReport(args.format || 'json');
                return {
                    content: [
                        {
                            type: 'text',
                            text: typeof metrics === 'string' ? metrics : JSON.stringify(metrics, null, 2),
                        },
                    ],
                };

            case 'checkops_get_health_status':
                const health = productionMetrics.getHealthStatus();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(health, null, 2),
                        },
                    ],
                };

            case 'checkops_get_performance_trends':
                const trends = productionMetrics.getPerformanceTrends(args.timeRangeMinutes || 60);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(trends, null, 2),
                        },
                    ],
                };

            default:
                throw new Error(`Unknown monitoring tool: ${name}`);
        }
    }

    async handleBatchOperations(name, args, checkops) {
        switch (name) {
            case 'checkops_bulk_create_forms':
                const forms = await recordBatchOperation(
                    'bulk_create_forms',
                    args.forms.length,
                    async () => await checkops.bulkCreateForms(args.forms)
                )();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully created ${forms.length} forms in bulk operation`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify(forms, null, 2),
                        },
                    ],
                };

            case 'checkops_bulk_create_submissions':
                const submissions = await recordBatchOperation(
                    'bulk_create_submissions',
                    args.submissions.length,
                    async () => await checkops.bulkCreateSubmissions(args.formId, args.submissions)
                )();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully created ${submissions.results?.length || 0} submissions, ${submissions.errors?.length || 0} errors`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify(submissions, null, 2),
                        },
                    ],
                };

            case 'checkops_bulk_create_questions':
                const questions = await recordBatchOperation(
                    'bulk_create_questions',
                    args.questions.length,
                    async () => await checkops.bulkCreateQuestions(args.questions)
                )();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully created ${questions.length} questions in bulk operation`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify(questions, null, 2),
                        },
                    ],
                };

            default:
                throw new Error(`Unknown batch operation: ${name}`);
        }
    }

    async handleCacheOperations(name, args, checkops) {
        switch (name) {
            case 'checkops_get_cache_stats':
                const cacheStats = checkops.getCacheStats ? checkops.getCacheStats() : { message: 'Cache statistics not available' };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(cacheStats, null, 2),
                        },
                    ],
                };

            case 'checkops_clear_cache':
                let clearResult;
                if (checkops.clearCache) {
                    clearResult = await checkops.clearCache(args.type || 'all', args.id);
                } else {
                    clearResult = { message: 'Cache clearing not available in this version' };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Cache cleared: ${args.type || 'all'}${args.id ? ` (ID: ${args.id})` : ''}`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify(clearResult, null, 2),
                        },
                    ],
                };

            default:
                throw new Error(`Unknown cache operation: ${name}`);
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('CheckOps MCP server running on stdio');
    }
}

const server = new CheckOpsMCPServer();
server.run().catch(console.error);