/**
 * Utility functions for CheckOps integration
 */

/**
 * Form builder helper - creates forms with common patterns
 */
export class FormBuilder {
    constructor() {
        this.formData = {
            title: '',
            description: '',
            questions: [],
            metadata: {},
        };
    }

    title(title) {
        this.formData.title = title;
        return this;
    }

    description(description) {
        this.formData.description = description;
        return this;
    }

    metadata(key, value) {
        if (typeof key === 'object') {
            this.formData.metadata = { ...this.formData.metadata, ...key };
        } else {
            this.formData.metadata[key] = value;
        }
        return this;
    }

    // Question builder methods
    textQuestion(text, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'text',
            required,
        });
        return this;
    }

    emailQuestion(text = 'Email Address', required = true) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'email',
            required,
        });
        return this;
    }

    selectQuestion(text, options, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'select',
            options,
            required,
        });
        return this;
    }

    multiSelectQuestion(text, options, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'multiselect',
            options,
            required,
        });
        return this;
    }

    ratingQuestion(text, scale = [1, 2, 3, 4, 5], required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'rating',
            options: scale,
            required,
        });
        return this;
    }

    booleanQuestion(text, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'boolean',
            required,
        });
        return this;
    }

    textareaQuestion(text, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'textarea',
            required,
        });
        return this;
    }

    dateQuestion(text, required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'date',
            required,
        });
        return this;
    }

    phoneQuestion(text = 'Phone Number', required = false) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'phone',
            required,
        });
        return this;
    }

    numberQuestion(text, required = false, validationRules = {}) {
        this.formData.questions.push({
            questionText: text,
            questionType: 'number',
            required,
            validationRules,
        });
        return this;
    }

    // Custom question
    customQuestion(questionData) {
        this.formData.questions.push(questionData);
        return this;
    }

    build() {
        if (!this.formData.title) {
            throw new Error('Form title is required');
        }
        if (this.formData.questions.length === 0) {
            throw new Error('At least one question is required');
        }
        return { ...this.formData };
    }
}

/**
 * Common form templates
 */
export const FormTemplates = {
    contactForm() {
        return new FormBuilder()
            .title('Contact Us')
            .description('Get in touch with our team')
            .textQuestion('Full Name', true)
            .emailQuestion('Email Address', true)
            .selectQuestion('Subject', [
                'General Inquiry',
                'Support Request',
                'Sales Question',
                'Partnership',
                'Other'
            ], true)
            .textareaQuestion('Message', true)
            .build();
    },

    feedbackForm() {
        return new FormBuilder()
            .title('Feedback Survey')
            .description('Help us improve our services')
            .ratingQuestion('Overall Satisfaction', [1, 2, 3, 4, 5], true)
            .multiSelectQuestion('Which services did you use?', [
                'Customer Support',
                'Sales',
                'Technical Support',
                'Billing',
                'Documentation'
            ])
            .booleanQuestion('Would you recommend us to others?', true)
            .textareaQuestion('Additional Comments')
            .build();
    },

    registrationForm() {
        return new FormBuilder()
            .title('User Registration')
            .description('Create your account')
            .textQuestion('First Name', true)
            .textQuestion('Last Name', true)
            .emailQuestion('Email Address', true)
            .phoneQuestion('Phone Number')
            .dateQuestion('Date of Birth', true)
            .selectQuestion('How did you hear about us?', [
                'Search Engine',
                'Social Media',
                'Friend Referral',
                'Advertisement',
                'Other'
            ])
            .build();
    },

    eventRegistration() {
        return new FormBuilder()
            .title('Event Registration')
            .description('Register for our upcoming event')
            .textQuestion('Full Name', true)
            .emailQuestion('Email Address', true)
            .selectQuestion('Ticket Type', [
                { key: 'early_bird', label: 'Early Bird - $50' },
                { key: 'regular', label: 'Regular - $75' },
                { key: 'vip', label: 'VIP - $150' }
            ], true)
            .multiSelectQuestion('Dietary Restrictions', [
                'Vegetarian',
                'Vegan',
                'Gluten-Free',
                'Nut Allergy',
                'None'
            ])
            .textareaQuestion('Special Requirements')
            .build();
    },

    jobApplication() {
        return new FormBuilder()
            .title('Job Application')
            .description('Apply for a position at our company')
            .textQuestion('Full Name', true)
            .emailQuestion('Email Address', true)
            .phoneQuestion('Phone Number', true)
            .selectQuestion('Position Applied For', [
                'Software Engineer',
                'Product Manager',
                'Designer',
                'Marketing Specialist',
                'Sales Representative'
            ], true)
            .selectQuestion('Experience Level', [
                { key: 'entry', label: 'Entry Level (0-2 years)' },
                { key: 'mid', label: 'Mid Level (3-5 years)' },
                { key: 'senior', label: 'Senior Level (6+ years)' }
            ], true)
            .textareaQuestion('Why are you interested in this position?', true)
            .textareaQuestion('Tell us about your relevant experience', true)
            .build();
    }
};

/**
 * Validation helpers
 */
export const ValidationHelpers = {
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    },

    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    },

    validateSubmissionData(submissionData, form) {
        const errors = [];

        form.questions.forEach(question => {
            const value = submissionData[question.questionText];

            // Check required fields
            if (question.required && (value === undefined || value === null || value === '')) {
                errors.push(`${question.questionText} is required`);
                return;
            }

            // Skip validation if field is empty and not required
            if (!value) return;

            // Type-specific validation
            switch (question.questionType) {
                case 'email':
                    if (!this.isValidEmail(value)) {
                        errors.push(`${question.questionText} must be a valid email address`);
                    }
                    break;

                case 'phone':
                    if (!this.isValidPhone(value)) {
                        errors.push(`${question.questionText} must be a valid phone number`);
                    }
                    break;

                case 'date':
                    if (!this.isValidDate(value)) {
                        errors.push(`${question.questionText} must be a valid date`);
                    }
                    break;

                case 'number':
                    if (isNaN(value)) {
                        errors.push(`${question.questionText} must be a number`);
                    }
                    break;

                case 'rating': {
                    const rating = parseInt(value, 10);
                    const validRatings = question.options || [1, 2, 3, 4, 5];
                    if (!validRatings.includes(rating)) {
                        errors.push(`${question.questionText} must be one of: ${validRatings.join(', ')}`);
                    }
                    break;
                }

                case 'select': {
                    if (question.options) {
                        const validOptions = typeof question.options[0] === 'object' && question.options[0]?.key
                            ? question.options.map(opt => opt.key)
                            : question.options;
                        if (!validOptions.includes(value)) {
                            errors.push(`${question.questionText} must be one of the provided options`);
                        }
                    }
                    break;
                }

                case 'multiselect': {
                    if (Array.isArray(value) && question.options) {
                        const validOptions = typeof question.options[0] === 'object' && question.options[0]?.key
                            ? question.options.map(opt => opt.key)
                            : question.options;
                        const invalidValues = value.filter(v => !validOptions.includes(v));
                        if (invalidValues.length > 0) {
                            errors.push(`${question.questionText} contains invalid options: ${invalidValues.join(', ')}`);
                        }
                    }
                    break;
                }
            }
        });

        return errors;
    }
};

/**
 * Data transformation helpers
 */
export const DataHelpers = {
    /**
     * Transform form data for API consumption
     */
    transformFormData(formData) {
        return {
            ...formData,
            questions: formData.questions.map(question => ({
                ...question,
                questionText: question.questionText.trim(),
                options: this.normalizeOptions(question.options),
            })),
        };
    },

    /**
     * Normalize options to consistent format
     */
    normalizeOptions(options) {
        if (!options) return undefined;

        return options.map(option => {
            if (typeof option === 'string' || typeof option === 'number') {
                return {
                    key: this.generateOptionKey(option),
                    label: option.toString(),
                };
            }
            return option;
        });
    },

    /**
     * Generate option key from label
     */
    generateOptionKey(label) {
        return label.toString()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    },

    /**
     * Convert submission data to CSV format
     */
    submissionsToCsv(submissions, form) {
        if (!submissions.length) return '';

        const headers = ['Submission ID', 'Created At', ...form.questions.map(q => q.questionText)];
        const rows = submissions.map(submission => [
            submission.id,
            submission.createdAt,
            ...form.questions.map(q => {
                const value = submission.submissionData[q.questionText];
                return Array.isArray(value) ? value.join('; ') : value || '';
            })
        ]);

        const escapeCell = (cell) => {
            const str = String(cell || '');
            // Prevent formula injection
            const safeStr = /^[=+\-@]/.test(str) ? `'${str}` : str;
            // Escape double quotes and wrap in quotes
            return `"${safeStr.replace(/"/g, '""')}"`;
        };

        return [headers, ...rows]
            .map(row => row.map(escapeCell).join(','))
            .join('\n');
    },

    /**
     * Generate form statistics summary
     */
    generateStatsSummary(stats) {
        const summary = {
            totalSubmissions: stats.totalSubmissions,
            questionsAnalyzed: Object.keys(stats.questionStats).length,
            insights: [],
        };

        Object.entries(stats.questionStats).forEach(([question, questionStats]) => {
            if (questionStats.type === 'rating') {
                const avgRating = questionStats.average || 0;
                summary.insights.push({
                    question,
                    type: 'rating',
                    averageRating: avgRating.toFixed(1),
                    totalResponses: questionStats.totalResponses,
                });
            } else if (questionStats.type === 'select' || questionStats.type === 'multiselect') {
                const topChoice = Object.entries(questionStats.optionCounts || {})
                    .sort(([, a], [, b]) => b - a)[0];

                if (topChoice) {
                    summary.insights.push({
                        question,
                        type: questionStats.type,
                        topChoice: topChoice[0],
                        topChoiceCount: topChoice[1],
                        totalResponses: questionStats.totalResponses,
                    });
                }
            }
        });

        return summary;
    }
};

/**
 * Configuration helpers
 */
export const ConfigHelpers = {
    /**
     * Load configuration from environment variables
     */
    loadFromEnv() {
        return {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true',

            // Wrapper options
            autoReconnect: process.env.CHECKOPS_AUTO_RECONNECT !== 'false',
            retryAttempts: parseInt(process.env.CHECKOPS_RETRY_ATTEMPTS) || 3,
            retryDelay: parseInt(process.env.CHECKOPS_RETRY_DELAY) || 1000,
            enableLogging: process.env.CHECKOPS_ENABLE_LOGGING !== 'false',
            enableMetrics: process.env.CHECKOPS_ENABLE_METRICS === 'true',
        };
    },

    /**
     * Validate configuration
     */
    validateConfig(config) {
        const required = ['database', 'user', 'password'];
        const missing = required.filter(key => !config[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }

        if (config.port && (config.port < 1 || config.port > 65535)) {
            throw new Error('Port must be between 1 and 65535');
        }

        return true;
    }
};

export default {
    FormBuilder,
    FormTemplates,
    ValidationHelpers,
    DataHelpers,
    ConfigHelpers,
};