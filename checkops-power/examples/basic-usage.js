/**
 * Basic CheckOps v3.0.0 Usage Example
 * Demonstrates new performance monitoring, batch operations, and caching features
 */

import { CheckOpsWrapper, FormBuilder, FormTemplates } from '../lib/index.js';
import {
    productionMetrics,
    metricsCollector,
    metricsMiddleware,
    recordBatchOperation
} from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Demonstrates CheckOps v3.0.0 features: performance monitoring, batch operations,
 * intelligent caching, health checks, and comprehensive metrics collection.
 */
async function basicUsageExample() {
    console.log('🚀 CheckOps v3.0.0 - Enhanced Usage Example');
    console.log('=============================================\n');

    // Initialize CheckOps wrapper with v3.0.0 optimizations
    const checkops = new CheckOpsWrapper({
        enableLogging: true,
        enableMetrics: true,
        retryAttempts: 3,

        // NEW v3.0.0 features
        enableCaching: true,
        enableQueryOptimization: true,
        batchSize: 500,
    });

    // NEW v3.0.0: Enable performance monitoring
    console.log('📊 Starting performance monitoring...');
    productionMetrics.startMonitoring(30000); // 30-second intervals

    // Enable intelligent caching
    checkops.enableCache();

    // Listen to events (existing + new v3.0.0 events)
    checkops.on('initialized', () => {
        console.log('✅ CheckOps v3.0.0 initialized successfully');
    });

    checkops.on('formCreated', (form) => {
        console.log(`📋 Form created: ${form.title} (ID: ${form.id})`);
    });

    checkops.on('submissionCreated', (submission) => {
        console.log(`📝 Submission created: ID ${submission.id}`);
    });

    // NEW v3.0.0: Monitor batch operations
    checkops.on('batchOperationCompleted', (result) => {
        console.log(`📦 Batch operation: ${result.successful} successful, ${result.failed} failed`);
    });

    try {
        // Example 1: Using FormBuilder (enhanced performance)
        console.log('📋 Creating form using FormBuilder (v3.0.0 optimized)...');
        const contactFormData = new FormBuilder()
            .title('Contact Us')
            .description('Get in touch with our team')
            .metadata('category', 'contact')
            .metadata('version', '3.0')
            .textQuestion('Full Name', true)
            .emailQuestion('Email Address', true)
            .selectQuestion('Subject', [
                'General Inquiry',
                'Support Request',
                'Sales Question',
                'Partnership'
            ], true)
            .textareaQuestion('Message', true)
            .build();

        const contactForm = await checkops.createForm(contactFormData);

        // Example 2: NEW v3.0.0 Batch Operations
        console.log('\n🚀 NEW v3.0.0: Creating multiple forms with batch operations...');

        const formsData = [
            FormTemplates.feedbackForm(),
            FormTemplates.registrationForm(),
            FormTemplates.eventRegistration()
        ];

        // Use batch operation for 30-70% performance improvement
        const batchForms = await recordBatchOperation(
            'bulk_create_forms',
            formsData.length,
            async () => await checkops.bulkCreateForms(formsData)
        )();

        console.log(`✅ Created ${batchForms.length} forms in batch operation`);

        // Example 3: NEW v3.0.0 Bulk Submissions (99% faster)
        console.log('\n⚡ NEW v3.0.0: Bulk submission creation...');

        const bulkSubmissions = [
            {
                'Full Name': 'John Doe',
                'Email Address': 'john@example.com',
                'Subject': 'General Inquiry',
                'Message': 'I would like to learn more about your services.',
            },
            {
                'Full Name': 'Jane Smith',
                'Email Address': 'jane@example.com',
                'Subject': 'Support Request',
                'Message': 'I need help with my account.',
            },
            {
                'Full Name': 'Bob Johnson',
                'Email Address': 'bob@example.com',
                'Subject': 'Sales Question',
                'Message': 'What are your pricing options?',
            }
        ];

        const bulkResult = await checkops.bulkCreateSubmissions(contactForm.id, bulkSubmissions);
        console.log(`📦 Bulk operation: ${bulkResult.results.length} successful, ${bulkResult.errors.length} errors`);

        // Example 4: Enhanced data retrieval with caching
        console.log('\n📊 Retrieving data with intelligent caching...');

        // Get form (with automatic caching)
        const retrievedForm = await checkops.getForm(contactForm.id, true);
        console.log(`Retrieved form: ${retrievedForm.title}`);

        // Get submissions with pagination
        const submissions = await checkops.getSubmissions(contactForm.id, {
            limit: 10,
            offset: 0,
        });
        console.log(`Retrieved ${submissions.length} submissions`);

        // Get statistics (optimized in v3.0.0 - 95% memory reduction)
        const stats = await checkops.getStats(contactForm.id, true);
        console.log(`Form statistics: ${stats.totalSubmissions} total submissions`);

        // Example 5: NEW v3.0.0 Performance Monitoring
        console.log('\n📈 NEW v3.0.0: Performance monitoring and health checks...');

        // Get comprehensive metrics
        const metrics = productionMetrics.exportMetricsReport('json');
        console.log('Performance Metrics:', {
            queries: metrics.queries?.count || 0,
            operations: Object.keys(metrics.operations || {}).length,
            cacheHitRate: metrics.cache?.hitRate || 0,
            systemHealth: metrics.system?.status || 'unknown'
        });

        // Get health status
        const health = productionMetrics.getHealthStatus();
        console.log('System Health:', {
            status: health.status,
            alerts: health.alerts?.length || 0,
            uptime: health.details?.uptime || 'unknown'
        });

        // Get performance trends
        const trends = productionMetrics.getPerformanceTrends(30); // Last 30 minutes
        console.log('Performance Trends:', {
            queryTimeChange: trends.queryTimeChange || 'N/A',
            errorRateChange: trends.errorRateChange || 'N/A',
            cacheEfficiencyChange: trends.cacheHitRateChange || 'N/A'
        });

        // Example 6: NEW v3.0.0 Cache Management
        console.log('\n🗄️ NEW v3.0.0: Cache management...');

        // Get cache statistics
        const cacheStats = checkops.getCacheStats ? checkops.getCacheStats() : null;
        if (cacheStats) {
            console.log('Cache Statistics:', {
                hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
                totalHits: cacheStats.totalHits,
                totalMisses: cacheStats.totalMisses,
                cacheSize: cacheStats.size
            });
        }

        // Example 7: Legacy metrics (enhanced in v3.0.0)
        console.log('\n📊 Enhanced metrics collection...');
        const legacyMetrics = checkops.getMetrics();
        console.log('Enhanced Metrics:', {
            operations: legacyMetrics.operations,
            errors: legacyMetrics.errors,
            forms: legacyMetrics.forms,
            submissions: legacyMetrics.submissions,
            errorRate: `${legacyMetrics.errorRate.toFixed(2)}%`,
            // NEW v3.0.0 metrics
            averageResponseTime: legacyMetrics.averageResponseTime || 'N/A',
            throughput: legacyMetrics.throughput || 'N/A'
        });

        console.log('\n🎉 CheckOps v3.0.0 example completed successfully!');
        console.log('✨ Performance improvements and new features demonstrated');

    } catch (error) {
        console.error('❌ Example failed:', error.message);

        // NEW v3.0.0: Enhanced error reporting
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.details) {
            console.error('Error details:', error.details);
        }
    } finally {
        // NEW v3.0.0: Stop monitoring and cleanup
        productionMetrics.stopMonitoring();
        await checkops.close();

        console.log('\n📊 Final Performance Summary:');
        const finalMetrics = productionMetrics.exportMetricsReport('json');
        console.log('- Total operations:', finalMetrics.operations ? Object.keys(finalMetrics.operations).length : 0);
        console.log('- System health:', finalMetrics.system?.status || 'unknown');
        console.log('- Cache efficiency:', finalMetrics.cache ? `${(finalMetrics.cache.hitRate * 100).toFixed(1)}%` : 'N/A');
    }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    basicUsageExample();
}

export default basicUsageExample;