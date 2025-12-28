#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import CheckOps from '@saiqa-tech/checkops';

class CheckOpsMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'checkops-tools',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.checkops = null;
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
            return this.checkops;
        } catch (error) {
            throw new Error(`Failed to initialize CheckOps: ${error.message}`);
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
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                const checkops = await this.initializeCheckOps();

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

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('CheckOps MCP server running on stdio');
    }
}

const server = new CheckOpsMCPServer();
server.run().catch(console.error);