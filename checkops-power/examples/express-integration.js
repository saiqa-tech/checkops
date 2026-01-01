/**
 * Express.js Integration Example with CheckOps v3.0.0
 * Demonstrates performance monitoring, batch operations, and health checks
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createCheckOpsRouter, CheckOpsWrapper } from '../lib/index.js';
import {
    productionMetrics,
    metricsMiddleware,
    getHealthCheckData,
    recordBatchOperation
} from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create and configure an Express application with CheckOps v3.0.0 features:
 * security, rate limiting, body parsing, performance monitoring, health checks,
 * batch operations, and comprehensive metrics collection.
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

    // NEW v3.0.0: Performance monitoring middleware
    app.use(metricsMiddleware());

    // NEW v3.0.0: Start performance monitoring
    if (process.env.ENABLE_MONITORING === 'true') {
        const interval = parseInt(process.env.MONITORING_INTERVAL) || 60000;
        productionMetrics.startMonitoring(interval);
        console.log(`📊 Performance monitoring enabled (${interval}ms intervals)`);
    }

    // Basic routes
    app.get('/', (req, res) => {
        res.json({
            message: 'CheckOps v3.0.0 Express Integration',
            version: '3.0.0',
            features: [
                'Performance Monitoring',
                'Batch Operations',
                'Intelligent Caching',
                'Health Checks',
                'Real-time Metrics'
            ],
            endpoints: {
                forms: '/api/checkops/forms',
                health: '/api/checkops/health',
                metrics: '/api/checkops/metrics',
                batch: '/api/checkops/batch',
            },
        });
    });

    // CheckOps router with v3.0.0 configuration
    const checkopsRouter = await createCheckOpsRouter({
        enableLogging: true,
        enableMetrics: true,
        retryAttempts: 3,
        autoReconnect: true,

        // NEW v3.0.0 features
        enableCaching: true,
        enableQueryOptimization: true,
        batchSize: parseInt(process.env.BATCH_SIZE_LIMIT) || 500,
    });

    // NEW v3.0.0: Enhanced health check endpoint
    app.get('/health', (req, res) => {
        try {
            const health = getHealthCheckData();
            const status = health.health?.status === 'HEALTHY' ? 200 : 503;
            res.status(status).json({
                ...health,
                version: '3.0.0',
                features: {
                    monitoring: process.env.ENABLE_MONITORING === 'true',
                    caching: process.env.ENABLE_CACHING === 'true',
                    batchOperations: true,
                    queryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION === 'true'
                }
            });
        } catch (error) {
            res.status(503).json({
                status: 'error',
                message: 'Health check failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // NEW v3.0.0: Comprehensive metrics endpoint
    app.get('/metrics', (req, res) => {
        try {
            const format = req.query.format || 'json';
            const metrics = productionMetrics.exportMetricsReport(format);

            if (format === 'text') {
                res.set('Content-Type', 'text/plain').send(metrics);
            } else {
                res.json(metrics);
            }
        } catch (error) {
            res.status(500).json({
                error: 'Failed to generate metrics',
                message: error.message
            });
        }
    });

    // NEW v3.0.0: Performance trends endpoint
    app.get('/api/performance/trends', (req, res) => {
        try {
            const timeRange = parseInt(req.query.minutes) || 60;
            const trends = productionMetrics.getPerformanceTrends(timeRange);
            res.json({
                timeRangeMinutes: timeRange,
                trends,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get performance trends',
                message: error.message
            });
        }
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

    // NEW v3.0.0: Batch operations endpoints
    checkopsRouter.post('/batch/forms', async (req, res) => {
        try {
            const start = performance.now();
            const { forms } = req.body;

            if (!Array.isArray(forms) || forms.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Forms array is required and must not be empty',
                });
            }

            // Use batch operation with monitoring
            const result = await recordBatchOperation(
                'bulk_create_forms_api',
                forms.length,
                async () => await req.checkops.bulkCreateForms(forms)
            )();

            res.status(201).json({
                success: true,
                data: result,
                count: result.length,
                processingTime: `${(performance.now() - start).toFixed(2)}ms`
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
                code: error.code || 'BATCH_OPERATION_FAILED'
            });
        }
    });

    checkopsRouter.post('/batch/submissions', async (req, res) => {
        try {
            const { formId, submissions } = req.body;

            if (!formId || !Array.isArray(submissions)) {
                return res.status(400).json({
                    success: false,
                    error: 'formId and submissions array are required',
                });
            }

            // Use batch operation with monitoring
            const result = await recordBatchOperation(
                'bulk_create_submissions_api',
                submissions.length,
                async () => await req.checkops.bulkCreateSubmissions(formId, submissions)
            )();

            res.status(201).json({
                success: true,
                data: result,
                summary: {
                    total: submissions.length,
                    successful: result.results?.length || 0,
                    failed: result.errors?.length || 0,
                    successRate: `${((result.results?.length || 0) / submissions.length * 100).toFixed(1)}%`
                }
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
                code: error.code || 'BATCH_SUBMISSION_FAILED'
            });
        }
    });

    checkopsRouter.post('/batch/questions', async (req, res) => {
        try {
            const { questions } = req.body;

            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Questions array is required and must not be empty',
                });
            }

            // Use batch operation with monitoring
            const result = await recordBatchOperation(
                'bulk_create_questions_api',
                questions.length,
                async () => await req.checkops.bulkCreateQuestions(questions)
            )();

            res.status(201).json({
                success: true,
                data: result,
                count: result.length
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
                code: error.code || 'BATCH_QUESTION_FAILED'
            });
        }
    });

    // NEW v3.0.0: Cache management endpoints
    checkopsRouter.get('/cache/stats', (req, res) => {
        try {
            const cacheStats = req.checkops.getCacheStats ? req.checkops.getCacheStats() : null;
            if (!cacheStats) {
                return res.json({
                    success: false,
                    message: 'Cache statistics not available'
                });
            }

            res.json({
                success: true,
                data: cacheStats,
                summary: {
                    hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
                    efficiency: cacheStats.hitRate > 0.8 ? 'excellent' :
                        cacheStats.hitRate > 0.6 ? 'good' : 'needs improvement'
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    checkopsRouter.delete('/cache/:type?', async (req, res) => {
        try {
            const { type } = req.params;
            const { id } = req.query;

            if (req.checkops.clearCache) {
                const result = await req.checkops.clearCache(type || 'all', id);
                res.json({
                    success: true,
                    message: `Cache cleared: ${type || 'all'}${id ? ` (ID: ${id})` : ''}`,
                    data: result
                });
            } else {
                res.json({
                    success: false,
                    message: 'Cache clearing not available'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

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
 * Starts the Express application with CheckOps v3.0.0 features, begins listening 
 * on the configured port, and installs graceful shutdown handlers for SIGINT and SIGTERM.
 * @returns {import('http').Server} The running HTTP server instance listening on the configured port.
 */
async function startServer() {
    try {
        const { app, port } = await createExpressApp();

        const server = app.listen(port, () => {
            console.log(`🚀 CheckOps v3.0.0 Express server running on port ${port}`);
            console.log(`📋 API endpoints available at http://localhost:${port}/api/checkops`);
            console.log(`🏥 Health check: http://localhost:${port}/health`);
            console.log(`📊 Metrics: http://localhost:${port}/metrics`);
            console.log(`📈 Performance trends: http://localhost:${port}/api/performance/trends`);
            console.log('\n🆕 NEW v3.0.0 Batch Endpoints:');
            console.log(`📦 Batch forms: POST http://localhost:${port}/api/checkops/batch/forms`);
            console.log(`📝 Batch submissions: POST http://localhost:${port}/api/checkops/batch/submissions`);
            console.log(`❓ Batch questions: POST http://localhost:${port}/api/checkops/batch/questions`);
            console.log(`🗄️ Cache stats: GET http://localhost:${port}/api/checkops/cache/stats`);
            console.log(`🧹 Clear cache: DELETE http://localhost:${port}/api/checkops/cache/{type}`);

            if (process.env.ENABLE_MONITORING === 'true') {
                console.log('\n📊 Performance monitoring is ENABLED');
            } else {
                console.log('\n💡 Tip: Set ENABLE_MONITORING=true to enable performance monitoring');
            }
        });

        // Enhanced graceful shutdown with v3.0.0 cleanup
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received, shutting down gracefully...`);

            // Stop performance monitoring
            if (productionMetrics) {
                productionMetrics.stopMonitoring();
                console.log('📊 Performance monitoring stopped');
            }

            server.close(() => {
                console.log('🔌 Server closed');
                console.log('👋 Goodbye!');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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