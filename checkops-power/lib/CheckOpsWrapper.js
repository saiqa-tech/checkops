import CheckOps from '@saiqa-tech/checkops';
import EventEmitter from 'events';

/**
 * CheckOpsWrapper - A convenient wrapper around CheckOps with additional utilities
 * for easier integration into Node.js applications
 */
export class CheckOpsWrapper extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Default configuration
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,

            // Wrapper-specific options
            autoReconnect: true,
            retryAttempts: 3,
            retryDelay: 1000,
            enableLogging: process.env.NODE_ENV !== 'production',
            enableMetrics: false,

            ...config
        };

        this.checkops = null;
        this.initialized = false;
        this.metrics = {
            operations: 0,
            errors: 0,
            forms: 0,
            submissions: 0,
            questions: 0,
        };
    }

    /**
     * Initialize CheckOps with automatic retry and error handling
     */
    async initialize() {
        if (this.initialized) {
            return this.checkops;
        }

        let lastError;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                this.log(`Initializing CheckOps (attempt ${attempt}/${this.config.retryAttempts})`);

                this.checkops = new CheckOps(this.config);
                await this.checkops.initialize();

                this.initialized = true;
                this.log('CheckOps initialized successfully');
                this.emit('initialized');

                return this.checkops;
            } catch (error) {
                lastError = error;
                this.log(`Initialization attempt ${attempt} failed: ${error.message}`);

                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }

        this.emit('error', lastError);
        throw new Error(`Failed to initialize CheckOps after ${this.config.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Create a form with validation and error handling
     */
    async createForm(formData) {
        return this.executeWithMetrics('createForm', async () => {
            this.validateFormData(formData);
            const form = await this.checkops.createForm(formData);
            this.metrics.forms++;
            this.emit('formCreated', form);
            return form;
        });
    }

    /**
     * Create a submission with validation
     */
    async createSubmission(submissionData) {
        return this.executeWithMetrics('createSubmission', async () => {
            this.validateSubmissionData(submissionData);
            const submission = await this.checkops.createSubmission(submissionData);
            this.metrics.submissions++;
            this.emit('submissionCreated', submission);
            return submission;
        });
    }

    /**
     * Create a question with validation
     */
    async createQuestion(questionData) {
        return this.executeWithMetrics('createQuestion', async () => {
            this.validateQuestionData(questionData);
            const question = await this.checkops.createQuestion(questionData);
            this.metrics.questions++;
            this.emit('questionCreated', question);
            return question;
        });
    }

    /**
     * Get form with caching support
     */
    async getForm(formId, useCache = false) {
        return this.executeWithMetrics('getForm', async () => {
            if (useCache && this.cache && this.cache.has(`form:${formId}`)) {
                return this.cache.get(`form:${formId}`);
            }

            const form = await this.checkops.getForm(formId);

            if (useCache && this.cache) {
                this.cache.set(`form:${formId}`, form, 300000); // 5 minutes
            }

            return form;
        });
    }

    /**
     * Get submissions with pagination helper
     */
    async getSubmissions(formId, options = {}) {
        return this.executeWithMetrics('getSubmissions', async () => {
            const defaultOptions = {
                limit: 50,
                offset: 0,
                ...options
            };

            return await this.checkops.getSubmissionsByForm(formId, defaultOptions);
        });
    }

    /**
     * Get submission statistics with caching
     */
    async getStats(formId, useCache = true) {
        return this.executeWithMetrics('getStats', async () => {
            const cacheKey = `stats:${formId}`;

            if (useCache && this.cache && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const stats = await this.checkops.getSubmissionStats(formId);

            if (useCache && this.cache) {
                this.cache.set(cacheKey, stats, 60000); // 1 minute
            }

            return stats;
        });
    }

    /**
     * Bulk operations helper
     */
    async bulkCreateSubmissions(formId, submissionsData) {
        return this.executeWithMetrics('bulkCreateSubmissions', async () => {
            const results = [];
            const errors = [];

            for (let i = 0; i < submissionsData.length; i++) {
                try {
                    const submission = await this.createSubmission({
                        formId,
                        submissionData: submissionsData[i],
                    });
                    results.push(submission);
                } catch (error) {
                    errors.push({ index: i, error: error.message, data: submissionsData[i] });
                }
            }

            return { results, errors, total: submissionsData.length };
        });
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.checkops.getFormCount();
            return {
                status: 'healthy',
                initialized: this.initialized,
                timestamp: new Date().toISOString(),
                metrics: this.getMetrics(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                initialized: this.initialized,
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Enable simple caching
     */
    enableCache(ttl = 300000) {
        this.cache = new Map();
        this.cacheTTL = ttl;

        // Simple TTL cleanup
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (value.expires && now > value.expires) {
                    this.cache.delete(key);
                }
            }
        }, 60000); // Cleanup every minute
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.initialized ? Date.now() - this.initTime : 0,
            errorRate: this.metrics.operations > 0 ?
                (this.metrics.errors / this.metrics.operations) * 100 : 0,
        };
    }

    /**
     * Close connection
     */
    async close() {
        if (this.checkops) {
            await this.checkops.close();
            this.initialized = false;
            this.emit('closed');
        }
    }

    // Private methods

    async executeWithMetrics(operation, fn) {
        await this.ensureInitialized();

        const startTime = Date.now();
        this.metrics.operations++;

        try {
            const result = await fn();
            const duration = Date.now() - startTime;

            if (this.config.enableLogging) {
                this.log(`${operation} completed in ${duration}ms`);
            }

            this.emit('operationComplete', { operation, duration, success: true });
            return result;
        } catch (error) {
            this.metrics.errors++;
            const duration = Date.now() - startTime;

            this.log(`${operation} failed in ${duration}ms: ${error.message}`);
            this.emit('operationComplete', { operation, duration, success: false, error: error.message });

            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    validateFormData(formData) {
        if (!formData.title || formData.title.trim() === '') {
            throw new Error('Form title is required');
        }

        if (!formData.questions || formData.questions.length === 0) {
            throw new Error('At least one question is required');
        }

        formData.questions.forEach((question, index) => {
            if (!question.questionText || question.questionText.trim() === '') {
                throw new Error(`Question ${index + 1} text is required`);
            }

            if (!question.questionType) {
                throw new Error(`Question ${index + 1} type is required`);
            }
        });
    }

    validateSubmissionData(submissionData) {
        if (!submissionData.formId) {
            throw new Error('Form ID is required for submission');
        }

        if (!submissionData.submissionData || typeof submissionData.submissionData !== 'object') {
            throw new Error('Submission data is required and must be an object');
        }
    }

    validateQuestionData(questionData) {
        if (!questionData.questionText || questionData.questionText.trim() === '') {
            throw new Error('Question text is required');
        }

        if (!questionData.questionType) {
            throw new Error('Question type is required');
        }
    }

    log(message) {
        if (this.config.enableLogging) {
            console.log(`[CheckOpsWrapper] ${new Date().toISOString()} - ${message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Cache implementation for the wrapper
class SimpleCache extends Map {
    set(key, value, ttl) {
        const expires = ttl ? Date.now() + ttl : null;
        super.set(key, { value, expires });
        return this;
    }

    get(key) {
        const item = super.get(key);
        if (!item) return undefined;

        if (item.expires && Date.now() > item.expires) {
            this.delete(key);
            return undefined;
        }

        return item.value;
    }

    has(key) {
        const item = super.get(key);
        if (!item) return false;

        if (item.expires && Date.now() > item.expires) {
            this.delete(key);
            return false;
        }

        return true;
    }
}

export default CheckOpsWrapper;