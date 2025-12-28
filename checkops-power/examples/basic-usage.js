/**
 * Basic CheckOps Wrapper Usage Example
 */

import { CheckOpsWrapper, FormBuilder, FormTemplates } from '../lib/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function basicUsageExample() {
    console.log('🚀 CheckOps Wrapper - Basic Usage Example');
    console.log('==========================================\n');

    // Initialize CheckOps wrapper
    const checkops = new CheckOpsWrapper({
        enableLogging: true,
        enableMetrics: true,
        retryAttempts: 3,
    });

    // Enable simple caching
    checkops.enableCache();

    // Listen to events
    checkops.on('initialized', () => {
        console.log('✅ CheckOps initialized successfully');
    });

    checkops.on('formCreated', (form) => {
        console.log(`📋 Form created: ${form.title} (ID: ${form.id})`);
    });

    checkops.on('submissionCreated', (submission) => {
        console.log(`📝 Submission created: ID ${submission.id}`);
    });

    try {
        // Example 1: Using FormBuilder
        console.log('📋 Creating form using FormBuilder...');
        const contactFormData = new FormBuilder()
            .title('Contact Us')
            .description('Get in touch with our team')
            .metadata('category', 'contact')
            .metadata('version', '1.0')
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

        // Example 2: Using Form Templates
        console.log('\n⭐ Creating feedback form using template...');
        const feedbackFormData = FormTemplates.feedbackForm();
        const feedbackForm = await checkops.createForm(feedbackFormData);

        // Example 3: Creating submissions
        console.log('\n📝 Creating sample submissions...');

        const contactSubmission = await checkops.createSubmission({
            formId: contactForm.id,
            submissionData: {
                'Full Name': 'John Doe',
                'Email Address': 'john@example.com',
                'Subject': 'General Inquiry',
                'Message': 'I would like to learn more about your services.',
            },
        });

        const feedbackSubmission = await checkops.createSubmission({
            formId: feedbackForm.id,
            submissionData: {
                'Overall Satisfaction': 5,
                'Which services did you use?': ['Customer Support', 'Technical Support'],
                'Would you recommend us to others?': true,
                'Additional Comments': 'Great service, very helpful team!',
            },
        });

        // Example 4: Retrieving data with caching
        console.log('\n📊 Retrieving data...');

        // Get form (with caching)
        const retrievedForm = await checkops.getForm(contactForm.id, true);
        console.log(`Retrieved form: ${retrievedForm.title}`);

        // Get submissions
        const submissions = await checkops.getSubmissions(feedbackForm.id, {
            limit: 10,
            offset: 0,
        });
        console.log(`Retrieved ${submissions.length} submissions`);

        // Get statistics (with caching)
        const stats = await checkops.getStats(feedbackForm.id, true);
        console.log(`Form statistics: ${stats.totalSubmissions} total submissions`);

        // Example 5: Bulk operations
        console.log('\n📦 Bulk submission example...');
        const bulkSubmissions = [
            {
                'Overall Satisfaction': 4,
                'Which services did you use?': ['Sales'],
                'Would you recommend us to others?': true,
                'Additional Comments': 'Good experience overall.',
            },
            {
                'Overall Satisfaction': 3,
                'Which services did you use?': ['Customer Support'],
                'Would you recommend us to others?': false,
                'Additional Comments': 'Could be better.',
            },
        ];

        const bulkResult = await checkops.bulkCreateSubmissions(feedbackForm.id, bulkSubmissions);
        console.log(`Bulk operation: ${bulkResult.results.length} successful, ${bulkResult.errors.length} errors`);

        // Example 6: Health check and metrics
        console.log('\n🏥 Health check and metrics...');
        const health = await checkops.healthCheck();
        console.log('Health status:', health.status);

        const metrics = checkops.getMetrics();
        console.log('Metrics:', {
            operations: metrics.operations,
            errors: metrics.errors,
            forms: metrics.forms,
            submissions: metrics.submissions,
            errorRate: `${metrics.errorRate.toFixed(2)}%`,
        });

        console.log('\n🎉 Basic usage example completed successfully!');

    } catch (error) {
        console.error('❌ Example failed:', error.message);
    } finally {
        await checkops.close();
    }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    basicUsageExample();
}

export default basicUsageExample;