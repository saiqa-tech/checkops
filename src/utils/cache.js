/**
 * LRU Cache Implementation with TTL support
 * Optimized for CheckOps form and question caching
 */

export class LRUCache {
    constructor(maxSize = 100, ttl = 300000) { // 5 minutes default TTL
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.cache = new Map();
        this.timers = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
        };
    }

    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, item);

        // Reset TTL timer with the original TTL
        this._resetTTL(key, item.ttl);

        return item.value;
    }

    set(key, value, customTTL = this.ttl) {
        // Evict oldest if at capacity and key doesn't exist
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldestKey = this.cache.keys().next().value;
            this.delete(oldestKey);
            this.stats.evictions++;
        }

        // Clear existing timer if updating existing key
        if (this.cache.has(key)) {
            this._clearTimer(key);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: customTTL
        });
        this.stats.sets++;

        this._resetTTL(key, customTTL);
    }

    delete(key) {
        const hadKey = this.cache.has(key);

        if (hadKey) {
            this.cache.delete(key);
            this.stats.deletes++;
            this._clearTimer(key);
        }

        return hadKey;
    }

    clear() {
        // Clear all timers
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();

        // Reset stats except for historical data
        const totalOperations = this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            totalOperationsBeforeClear: totalOperations,
        };
    }

    has(key) {
        return this.cache.has(key);
    }

    size() {
        return this.cache.size;
    }

    keys() {
        return Array.from(this.cache.keys());
    }

    _resetTTL(key, ttl = this.ttl) {
        this._clearTimer(key);

        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl);

        this.timers.set(key, timer);
    }

    _clearTimer(key) {
        const existingTimer = this.timers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.timers.delete(key);
        }
    }

    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;

        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
            utilizationRate: this.cache.size / this.maxSize,
            avgTTL: this.ttl,
        };
    }

    // Get cache entries with metadata
    inspect() {
        const entries = [];
        const now = Date.now();

        this.cache.forEach((item, key) => {
            const timer = this.timers.get(key);
            entries.push({
                key,
                value: item.value,
                age: now - item.timestamp,
                ttl: item.ttl,
                hasTimer: !!timer,
            });
        });

        return entries;
    }

    // Peek at a value without updating LRU order or TTL
    peek(key) {
        // Access the underlying Map directly without triggering LRU behavior
        const entries = Array.from(this.cache.entries());
        const entry = entries.find(([k]) => k === key);
        if (!entry) {
            return undefined;
        }
        return entry[1].value;
    }
}

/**
 * Multi-level cache for different data types
 * Optimized for CheckOps usage patterns
 */
export class CheckOpsCache {
    constructor() {
        // Different cache configurations for different data types
        this.formCache = new LRUCache(100, 300000);      // 100 forms, 5 min TTL
        this.questionCache = new LRUCache(200, 600000);   // 200 question sets, 10 min TTL
        this.statsCache = new LRUCache(50, 180000);       // 50 stats objects, 3 min TTL
        this.submissionCache = new LRUCache(500, 120000); // 500 submissions, 2 min TTL
    }

    // Form caching methods
    getForm(id) {
        return this.formCache.get(`form:${id}`);
    }

    setForm(id, form, ttl) {
        this.formCache.set(`form:${id}`, form, ttl);
    }

    deleteForm(id) {
        return this.formCache.delete(`form:${id}`);
    }

    // Question caching methods
    getQuestions(ids) {
        const key = `questions:${ids.sort().join(',')}`;
        return this.questionCache.get(key);
    }

    setQuestions(ids, questions, ttl) {
        const key = `questions:${ids.sort().join(',')}`;
        this.questionCache.set(key, questions, ttl);
    }

    deleteQuestions(ids) {
        const key = `questions:${ids.sort().join(',')}`;
        return this.questionCache.delete(key);
    }

    // Stats caching methods
    getStats(formId) {
        return this.statsCache.get(`stats:${formId}`);
    }

    setStats(formId, stats, ttl) {
        this.statsCache.set(`stats:${formId}`, stats, ttl);
    }

    deleteStats(formId) {
        return this.statsCache.delete(`stats:${formId}`);
    }

    // Submission caching methods
    getSubmission(id) {
        return this.submissionCache.get(`submission:${id}`);
    }

    setSubmission(id, submission, ttl) {
        this.submissionCache.set(`submission:${id}`, submission, ttl);
    }

    deleteSubmission(id) {
        return this.submissionCache.delete(`submission:${id}`);
    }

    // Bulk operations
    invalidateForm(formId) {
        // When a form is updated, invalidate related caches
        this.deleteForm(formId);
        this.deleteStats(formId);

        // Clear submission cache entries for this form
        const submissionKeys = this.submissionCache.keys();
        submissionKeys.forEach(key => {
            const submission = this.submissionCache.peek(key);
            if (submission && submission.formId === formId) {
                this.submissionCache.delete(key);
            }
        });
    }

    invalidateQuestion(questionId) {
        // When a question is updated, invalidate question caches that contain it
        const questionKeys = this.questionCache.keys();
        questionKeys.forEach(key => {
            // Parse the cache key to extract question IDs (format: "questions:id1,id2,id3")
            if (key.startsWith('questions:')) {
                const questionIds = key.substring('questions:'.length).split(',');
                if (questionIds.includes(questionId)) {
                    this.questionCache.delete(key);
                }
            }
        });
    }

    // Get comprehensive cache statistics
    getCacheStats() {
        return {
            forms: this.formCache.getStats(),
            questions: this.questionCache.getStats(),
            stats: this.statsCache.getStats(),
            submissions: this.submissionCache.getStats(),
            overall: {
                totalSize: this.formCache.size() + this.questionCache.size() +
                    this.statsCache.size() + this.submissionCache.size(),
                totalHits: this.formCache.getStats().hits + this.questionCache.getStats().hits +
                    this.statsCache.getStats().hits + this.submissionCache.getStats().hits,
                totalMisses: this.formCache.getStats().misses + this.questionCache.getStats().misses +
                    this.statsCache.getStats().misses + this.submissionCache.getStats().misses,
            }
        };
    }

    // Clear all caches
    clear() {
        this.formCache.clear();
        this.questionCache.clear();
        this.statsCache.clear();
        this.submissionCache.clear();
    }
}

// Export singleton instance for global use
export const checkOpsCache = new CheckOpsCache();