import CheckOps from '../../src/index.js';
import EventEmitter from 'events';

/**
 * CheckOpsWrapper - A convenient wrapper around CheckOps with additional utilities
 * for easier integration into Node.js applications
 * 
 * @class CheckOpsWrapper
 * @extends EventEmitter
 * @example
 * const wrapper = new CheckOpsWrapper({
 *   enableLogging: true,
 *   enableMetrics: true,
 *   retryAttempts: 3
 * });
 * await wrapper.initialize();
 */
export class CheckOpsWrapper extends EventEmitter {
    /**
     * Create a CheckOpsWrapper instance
     * @param {Object} config - Configuration options
     * @param {string} [config.host] - Database host
     * @param {number} [config.port] - Database port
     * @param {string} [config.database] - Database name
     * @param {string} [config.user] - Database user
     * @param {string} [config.password] - Database password
     * @param {boolean} [config.autoReconnect=true] - Enable automatic reconnection
     * @param {number} [config.retryAttempts=3] - Number of retry attempts
     * @param {number} [config.retryDelay=1000] - Delay between retries in ms
     * @param {boolean} [config.enableLogging] - Enable logging
     * @param {boolean} [config.enableMetrics=false] - Enable metrics collection
     */
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
     * @returns {Promise<CheckOps>} The initialized CheckOps instance
     * @throws {Error} If initialization fails after all retry attempts
     * @emits CheckOpsWrapper#initialized
     * @emits CheckOpsWrapper#error
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
                this.initTime = Date.now();
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
     * @param {Object} formData - Form configuration object
     * @param {string} formData.title - Form title
     * @param {string} [formData.description] - Form description
     * @param {Array<Object>} formData.questions - Array of question objects
     * @returns {Promise<Object>} The created form object
     * @throws {Error} If form validation fails or creation fails
     * @emits CheckOpsWrapper#formCreated
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
     * @param {Object} submissionData - Submission data object
     * @param {string|number} submissionData.formId - Form ID
     * @param {Object} submissionData.submissionData - Submission data
     * @returns {Promise<Object>} The created submission object
     * @throws {Error} If submission validation fails or creation fails
     * @emits CheckOpsWrapper#submissionCreated
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
     * @param {Object} questionData - Question configuration object
     * @param {string} questionData.questionText - Question text
     * @param {string} questionData.questionType - Question type
     * @param {Array} [questionData.options] - Question options for select/multiselect
     * @param {boolean} [questionData.required] - Whether question is required
     * @param {Object} [questionData.metadata] - Additional metadata
     * @returns {Promise<Object>} The created question object
     * @throws {Error} If question validation fails or creation fails
     * @emits CheckOpsWrapper#questionCreated
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
     * @param {string|number} formId - Form ID to retrieve
     * @param {boolean} [useCache=false] - Whether to use cached data
     * @returns {Promise<Object>} The form object
     * @throws {Error} If form retrieval fails
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
     * @param {string|number} formId - Form ID to get submissions for
     * @param {Object} [options={}] - Query options
     * @param {number} [options.limit=50] - Maximum number of submissions to return
     * @param {number} [options.offset=0] - Number of submissions to skip
     * @returns {Promise<Array<Object>>} Array of submission objects
     * @throws {Error} If submission retrieval fails
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
     * @param {string|number} formId - Form ID to get statistics for
     * @param {boolean} [useCache=true] - Whether to use cached data
     * @returns {Promise<Object>} Statistics object with submission counts and question stats
     * @throws {Error} If statistics retrieval fails
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
     * Bulk operations helper for creating multiple submissions
     * @param {string|number} formId - Form ID to create submissions for
     * @param {Array<Object>} submissionsData - Array of submission data objects
     * @returns {Promise<Object>} Object with results, errors, and total count
     * @throws {Error} If bulk operation setup fails
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
     * Health check to verify CheckOps connection and functionality
     * @returns {Promise<Object>} Health status object with status, metrics, and timestamp
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
     * Enable simple caching with TTL support
     * @param {number} [ttl=300000] - Time to live in milliseconds (default: 5 minutes)
     */
    enableCache(ttl = 300000) {
        // Clear existing interval if any
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }

        this.cache = new SimpleCache();
        this.cacheTTL = ttl;

        // Simple TTL cleanup
        this.cacheCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (value.expires && now > value.expires) {
                    this.cache.delete(key);
                }
            }
        }, 60000); // Cleanup every minute
    }

    /**
     * Get current metrics and performance statistics
     * @returns {Object} Metrics object with operations, errors, uptime, and error rate
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
     * Close connection and cleanup resources
     * @returns {Promise<void>}
     * @emits CheckOpsWrapper#closed
     */
    async close() {
        // Clear cache cleanup interval
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }

        // Clear cache
        if (this.cache) {
            this.cache.clear();
            this.cache = null;
        }

        if (this.checkops) {
            await this.checkops.close();
            this.initialized = false;
            this.emit('closed');
        }
    }

    // Private methods

    /**
     * Execute an operation with metrics tracking and error handling
     * @private
     * @param {string} operation - Operation name for logging
     * @param {Function} fn - Function to execute
     * @returns {Promise<*>} Result of the function execution
     * @throws {Error} If the operation fails
     * @emits CheckOpsWrapper#operationComplete
     */
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

    /**
     * Ensure CheckOps is initialized before executing operations
     * @private
     * @returns {Promise<void>}
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Validate form data structure and required fields
     * @private
     * @param {Object} formData - Form data to validate
     * @throws {Error} If validation fails
     */
    validateFormData(formData) {
        if (!formData.title || formData.title.trim() === '') {
            throw new Error('Form title is required');
        }

        if (!formData.questions || formData.questions.length === 0) {
            throw new Error('At least one question is required');
        }

        formData.questions.forEach((question, index) => {
            // Allow questions with questionId OR questionText
            if (!question.questionId && (!question.questionText || question.questionText.trim() === '')) {
                throw new Error(`Question ${index + 1} text is required`);
            }

            // Only validate questionType if questionId is not provided
            if (!question.questionId && !question.questionType) {
                throw new Error(`Question ${index + 1} type is required`);
            }
        });
    }

    /**
     * Validate submission data structure and required fields
     * @private
     * @param {Object} submissionData - Submission data to validate
     * @throws {Error} If validation fails
     */
    validateSubmissionData(submissionData) {
        if (!submissionData.formId) {
            throw new Error('Form ID is required for submission');
        }

        if (!submissionData.submissionData || typeof submissionData.submissionData !== 'object') {
            throw new Error('Submission data is required and must be an object');
        }
    }

    /**
     * Validate question data structure and required fields
     * @private
     * @param {Object} questionData - Question data to validate
     * @throws {Error} If validation fails
     */
    validateQuestionData(questionData) {
        if (!questionData.questionText || questionData.questionText.trim() === '') {
            throw new Error('Question text is required');
        }

        if (!questionData.questionType) {
            throw new Error('Question type is required');
        }
    }

    /**
     * Log a message if logging is enabled
     * @private
     * @param {string} message - Message to log
     */
    log(message) {
        if (this.config.enableLogging) {
            console.log(`[CheckOpsWrapper] ${new Date().toISOString()} - ${message}`);
        }
    }

    /**
     * Create a delay for retry logic
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Simple cache implementation with TTL support for the CheckOpsWrapper
 * @class SimpleCache
 * @extends Map
 */
class SimpleCache extends Map {
    /**
     * Set a value in the cache with optional TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} [ttl] - Time to live in milliseconds
     * @returns {SimpleCache} This cache instance for chaining
     */
    set(key, value, ttl) {
        const expires = ttl ? Date.now() + ttl : null;
        super.set(key, { value, expires });
        return this;
    }

    /**
     * Get a value from the cache, checking TTL expiration
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined if not found or expired
     */
    get(key) {
        const item = super.get(key);
        if (!item) return undefined;

        if (item.expires && Date.now() > item.expires) {
            this.delete(key);
            return undefined;
        }

        return item.value;
    }

    /**
     * Check if a key exists in the cache and is not expired
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists and is not expired
     */
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