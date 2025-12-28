import { CheckOpsWrapper } from './CheckOpsWrapper.js';

/**
 * Express.js middleware for CheckOps integration
 */

/**
 * Create CheckOps middleware for Express applications
 */
export function createCheckOpsMiddleware(config = {}) {
    const wrapper = new CheckOpsWrapper(config);

    return async (req, res, next) => {
        try {
            await wrapper.initialize();
            req.checkops = wrapper;
            next();
        } catch (error) {
            console.error('CheckOps middleware initialization failed:', error);
            res.status(503).json({
                error: 'CheckOps service unavailable',
                message: error.message,
            });
        }
    };
}

/**
 * Form creation endpoint middleware
 */
export function createFormEndpoint() {
    return async (req, res) => {
        try {
            const form = await req.checkops.createForm(req.body);
            res.status(201).json({
                success: true,
                data: form,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    };
}

/**
 * Submission creation endpoint middleware
 */
export function createSubmissionEndpoint() {
    return async (req, res) => {
        try {
            const submission = await req.checkops.createSubmission(req.body);
            res.status(201).json({
                success: true,
                data: submission,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    };
}

/**
 * Form retrieval endpoint middleware
 */
export function getFormEndpoint() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const useCache = req.query.cache !== 'false';

            const form = await req.checkops.getForm(id, useCache);
            res.json({
                success: true,
                data: form,
            });
        } catch (error) {
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                error: error.message,
            });
        }
    };
}

/**
 * Submissions retrieval endpoint middleware
 */
export function getSubmissionsEndpoint() {
    return async (req, res) => {
        try {
            const { formId } = req.params;
            const { limit, offset, ...filters } = req.query;

            const options = {
                limit: parseInt(limit) || 50,
                offset: parseInt(offset) || 0,
                ...filters,
            };

            const submissions = await req.checkops.getSubmissions(formId, options);
            res.json({
                success: true,
                data: submissions,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    };
}

/**
 * Statistics endpoint middleware
 */
export function getStatsEndpoint() {
    return async (req, res) => {
        try {
            const { formId } = req.params;
            const useCache = req.query.cache !== 'false';

            const stats = await req.checkops.getStats(formId, useCache);
            res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    };
}

/**
 * Health check endpoint middleware
 */
export function healthCheckEndpoint() {
    return async (req, res) => {
        try {
            const health = await req.checkops.healthCheck();
            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    };
}

/**
 * Metrics endpoint middleware
 */
export function metricsEndpoint() {
    return (req, res) => {
        const metrics = req.checkops.getMetrics();
        res.json({
            success: true,
            data: metrics,
        });
    };
}

/**
 * Error handling middleware for CheckOps operations
 */
export function checkOpsErrorHandler() {
    return (error, req, res, next) => {
        console.error('CheckOps Error:', error);

        let statusCode = 500;
        let errorType = 'INTERNAL_ERROR';
        let message = 'Internal server error';

        if (error.message.includes('validation')) {
            statusCode = 400;
            errorType = 'VALIDATION_ERROR';
            message = error.message;
        } else if (error.message.includes('not found')) {
            statusCode = 404;
            errorType = 'NOT_FOUND_ERROR';
            message = 'Resource not found';
        } else if (error.message.includes('duplicate')) {
            statusCode = 409;
            errorType = 'DUPLICATE_ERROR';
            message = 'Resource already exists';
        } else if (error.message.includes('connection')) {
            statusCode = 503;
            errorType = 'CONNECTION_ERROR';
            message = 'Service temporarily unavailable';
        }

        res.status(statusCode).json({
            success: false,
            error: {
                type: errorType,
                message,
                timestamp: new Date().toISOString(),
            },
        });
    };
}

/**
 * Complete Express router setup
 */
export function createCheckOpsRouter(config = {}) {
    const express = await import('express');
    const router = express.Router();

    // Apply CheckOps middleware
    router.use(createCheckOpsMiddleware(config));

    // Define routes
    router.post('/forms', createFormEndpoint());
    router.get('/forms/:id', getFormEndpoint());
    router.post('/forms/:formId/submissions', createSubmissionEndpoint());
    router.get('/forms/:formId/submissions', getSubmissionsEndpoint());
    router.get('/forms/:formId/stats', getStatsEndpoint());
    router.get('/health', healthCheckEndpoint());
    router.get('/metrics', metricsEndpoint());

    // Error handling
    router.use(checkOpsErrorHandler());

    return router;
}