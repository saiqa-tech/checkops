import { CheckOpsWrapper } from './CheckOpsWrapper.js';

/**
 * Express.js middleware for CheckOps integration
 */

/**
 * Build an Express middleware that initializes a CheckOpsWrapper and attaches it to incoming requests.
 * @param {object} [config={}] - Configuration passed to CheckOpsWrapper constructor.
 * @returns {function} An Express middleware function that attaches `req.checkops` on successful initialization; on initialization failure responds with HTTP 503 and a JSON error body.
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
 * Creates an Express route handler that creates a form from the request body and sends JSON responses.
 *
 * The handler expects `req.checkops.createForm` to be available (attached by middleware) and uses `req.body`
 * as the form payload.
 *
 * @returns {Function} An Express route handler that responds with 201 and `{ success: true, data }` on success,
 * or 400 and `{ success: false, error }` on failure.
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
 * Create an Express route handler that creates a submission via `req.checkops` and sends the appropriate JSON response.
 *
 * @returns {Function} Express middleware that:
 *  - on success responds with status 201 and `{ success: true, data: <submission> }`,
 *  - on failure responds with status 400 and `{ success: false, error: <error message> }`.
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
 * Create an Express handler that retrieves a form by ID and returns it as JSON.
 *
 * The handler reads `req.params.id` for the form identifier and `req.query.cache`
 * to determine whether to use cached data (`'false'` disables cache; all other
 * values enable it). It calls `req.checkops.getForm(id, useCache)` and on
 * success responds with `{ success: true, data: form }`. On failure it responds
 * with `{ success: false, error: string }` and sets the HTTP status to 404 if
 * the error message includes `"not found"`, otherwise 500.
 *
 * @returns {import('express').RequestHandler} Express request handler.
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
 * Create an Express route handler that returns submissions for a form with pagination and filter support.
 *
 * The handler reads `formId` from route params and `limit`, `offset`, and other filters from the query,
 * requests submissions from `req.checkops`, and responds with a JSON payload containing `success`, `data`,
 * and `pagination` on success. On error it responds with status 500 and a JSON `{ success: false, error }`.
 *
 * @returns {import('express').RequestHandler} Express middleware that handles submissions retrieval.
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
 * Creates an Express handler that returns statistics for a specific form.
 *
 * The handler reads `formId` from `req.params` and an optional `cache` query
 * parameter (`'false'` disables caching). On success it responds with
 * `{ success: true, data: stats }`. On failure it responds with status 500
 * and `{ success: false, error: <message> }`.
 *
 * @returns {import('express').RequestHandler} Express request handler for the stats endpoint.
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
 * Create an Express middleware that responds with the CheckOps health status.
 *
 * @returns {import('express').RequestHandler} An Express middleware that sends the health object from `req.checkops.healthCheck()`. Responds with status 200 when `health.status === 'healthy'`, 503 otherwise. If the health check throws, responds with status 503 and a health object containing `status: 'unhealthy'`, the error message, and a `timestamp`.
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
 * Create an Express route handler that returns CheckOps metrics.
 *
 * @returns {function} An Express middleware function that responds with JSON `{ success: true, data: metrics }`,
 * where `metrics` is obtained from `req.checkops.getMetrics()`.
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
 * Create an Express error-handling middleware that maps CheckOps errors to HTTP status codes and a structured JSON error response.
 *
 * The middleware logs the error and responds with a JSON payload:
 * { success: false, error: { type, message, timestamp } }.
 * It classifies errors by inspecting `error.message` and selects status and `type` as follows:
 * - messages containing "validation" => 400, `VALIDATION_ERROR`, returns the original error message
 * - messages containing "not found"  => 404, `NOT_FOUND_ERROR`, message "Resource not found"
 * - messages containing "duplicate"  => 409, `DUPLICATE_ERROR`, message "Resource already exists"
 * - messages containing "connection" => 503, `CONNECTION_ERROR`, message "Service temporarily unavailable"
 * - otherwise => 500, `INTERNAL_ERROR`, message "Internal server error"
 *
 * @returns {function} An Express error-handling middleware function with signature (error, req, res, next).
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
 * Create and configure an Express router with CheckOps middleware, routes, and error handling.
 * @param {object} [config] - Configuration forwarded to the CheckOps middleware.
 * @returns {import('express').Router} An Express Router configured with CheckOps middleware, endpoints for forms, submissions, stats, health, metrics, and the CheckOps error handler.
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