/**
 * Express.js Integration Example
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createCheckOpsRouter, CheckOpsWrapper } from '../lib/index.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create and configure an Express application with security, rate limiting,
 * body parsing, CheckOps routes, and several example API endpoints.
 *
 * The returned app includes middleware for Helmet, CORS, and request limiting,
 * mounts the CheckOps router at `/api/checkops`, and exposes example endpoints
 * for form templates, bulk submissions, CSV export, and analytics. It also
 * installs global error and 404 handlers.
 *
 * @returns {{ app: import('express').Application, port: number|string }} An object containing the configured Express `app` and the selected `port`.
 */
async function createExpressApp() {
    const app = express();
    const port = process.env.PORT || 3000;

    // Security middleware
    app.use(helmet());
    app.use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
    });
    app.use('/api/', limiter);

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Basic routes
    app.get('/', (req, res) => {
        res.json({
            message: 'CheckOps Express Integration Example',
            version: '1.0.0',
            endpoints: {
                forms: '/api/checkops/forms',
                health: '/api/checkops/health',
                metrics: '/api/checkops/metrics',
            },
        });
    });

    // CheckOps router with configuration
    const checkopsRouter = await createCheckOpsRouter({
        enableLogging: true,
        enableMetrics: true,
        retryAttempts: 3,
        autoReconnect: true,
    });

    // Custom CheckOps endpoints - mount on the router to have access to req.checkops
    checkopsRouter.post('/forms/template/:templateName', async (req, res) => {
        try {
            const { templateName } = req.params;
            const { FormTemplates } = await import('../lib/utils.js');

            let formData;
            switch (templateName) {
                case 'contact':
                    formData = FormTemplates.contactForm();
                    break;
                case 'feedback':
                    formData = FormTemplates.feedbackForm();
                    break;
                case 'registration':
                    formData = FormTemplates.registrationForm();
                    break;
                case 'event':
                    formData = FormTemplates.eventRegistration();
                    break;
                case 'job':
                    formData = FormTemplates.jobApplication();
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Unknown template name',
                        availableTemplates: ['contact', 'feedback', 'registration', 'event', 'job'],
                    });
            }

            // Override with custom data if provided
            if (req.body.title) formData.title = req.body.title;
            if (req.body.description) formData.description = req.body.description;
            if (req.body.metadata) formData.metadata = { ...formData.metadata, ...req.body.metadata };

            const form = await req.checkops.createForm(formData);
            res.status(201).json({
                success: true,
                data: form,
                template: templateName,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    });

    app.use('/api/checkops', checkopsRouter);

    // Bulk submission endpoint
    app.post('/api/forms/:formId/submissions/bulk', async (req, res) => {
        try {
            const { formId } = req.params;
            const { submissions } = req.body;

            if (!Array.isArray(submissions)) {
                return res.status(400).json({
                    success: false,
                    error: 'Submissions must be an array',
                });
            }

            const result = await req.checkops.bulkCreateSubmissions(formId, submissions);
            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    });

    // Export submissions as CSV
    app.get('/api/forms/:formId/export/csv', async (req, res) => {
        try {
            const { formId } = req.params;

            // Get form and submissions
            const form = await req.checkops.getForm(formId);
            const submissions = await req.checkops.getSubmissions(formId, {
                limit: 1000, // Adjust as needed
                offset: 0,
            });

            // Convert to CSV
            const { DataHelpers } = await import('../lib/utils.js');
            const csv = DataHelpers.submissionsToCsv(submissions, form);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${form.title}-submissions.csv"`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // Form analytics endpoint
    app.get('/api/forms/:formId/analytics', async (req, res) => {
        try {
            const { formId } = req.params;

            const stats = await req.checkops.getStats(formId);
            const { DataHelpers } = await import('../lib/utils.js');
            const summary = DataHelpers.generateStatsSummary(stats);

            res.json({
                success: true,
                data: {
                    detailed: stats,
                    summary,
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // Global error handler
    app.use((error, req, res, next) => {
        console.error('Unhandled error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    });

    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            path: req.originalUrl,
        });
    });

    return { app, port };
}

/**
 * Starts the Express application, begins listening on the configured port, and installs graceful shutdown handlers for SIGINT and SIGTERM.
 * @returns {import('http').Server} The running HTTP server instance listening on the configured port.
 */
async function startServer() {
    try {
        const { app, port } = await createExpressApp();

        const server = app.listen(port, () => {
            console.log(`🚀 CheckOps Express server running on port ${port}`);
            console.log(`📋 API endpoints available at http://localhost:${port}/api/checkops`);
            console.log(`🏥 Health check: http://localhost:${port}/api/checkops/health`);
            console.log(`📊 Metrics: http://localhost:${port}/api/checkops/metrics`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer();
}

export { createExpressApp, startServer };