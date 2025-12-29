import { FormBuilder, FormTemplates, ValidationHelpers } from '../../checkops-power/lib/utils.js';

describe('CheckOps Power Utils: FormBuilder & Validation', () => {
    describe('FormBuilder: Fluent API', () => {
        test('should create form with title', () => {
            const form = new FormBuilder()
                .title('Contact Form')
                .textQuestion('Name')
                .build();

            expect(form.title).toBe('Contact Form');
        });

        test('should add text question', () => {
            const form = new FormBuilder()
                .title('Test')
                .textQuestion('Your Name', true)
                .build();

            expect(form.questions).toHaveLength(1);
            expect(form.questions[0].questionType).toBe('text');
            expect(form.questions[0].required).toBe(true);
        });

        test('should add email question', () => {
            const form = new FormBuilder()
                .title('Test')
                .emailQuestion('Email', true)
                .build();

            expect(form.questions[0].questionType).toBe('email');
        });

        test('should add select question', () => {
            const form = new FormBuilder()
                .title('Test')
                .selectQuestion('Choose', [{ key: 'a', label: 'Option A' }])
                .build();

            expect(form.questions[0].questionType).toBe('select');
            expect(form.questions[0].options).toBeDefined();
        });

        test('should add rating question', () => {
            const form = new FormBuilder()
                .title('Test')
                .ratingQuestion('Rate', [1, 2, 3, 4, 5])
                .build();

            expect(form.questions[0].questionType).toBe('rating');
        });

        test('should add multiselect question', () => {
            const form = new FormBuilder()
                .title('Test')
                .multiSelectQuestion('Select', [{ key: 'opt1', label: 'Opt1' }])
                .build();

            expect(form.questions[0].questionType).toBe('multiselect');
        });

        test('should add boolean question', () => {
            const form = new FormBuilder()
                .title('Test')
                .booleanQuestion('Agree?', false)
                .build();

            expect(form.questions[0].questionType).toBe('boolean');
        });

        test('should add textarea question', () => {
            const form = new FormBuilder()
                .title('Test')
                .textareaQuestion('Comments')
                .build();

            expect(form.questions[0].questionType).toBe('textarea');
        });

        test('should set description', () => {
            const form = new FormBuilder()
                .title('Test')
                .description('Test Description')
                .textQuestion('Q', false)
                .build();

            expect(form.description).toBe('Test Description');
        });

        test('should add metadata', () => {
            const form = new FormBuilder()
                .title('Test')
                .textQuestion('Q', false)
                .metadata('version', '1.0')
                .metadata('category', 'feedback')
                .build();

            expect(form.metadata.version).toBe('1.0');
            expect(form.metadata.category).toBe('feedback');
        });

        test('should maintain question order', () => {
            const form = new FormBuilder()
                .title('Order Test')
                .textQuestion('Q1', false)
                .emailQuestion('Q2', false)
                .selectQuestion('Q3', [{ key: 'a', label: 'A' }])
                .build();

            expect(form.questions).toHaveLength(3);
            expect(form.questions[0].questionType).toBe('text');
            expect(form.questions[1].questionType).toBe('email');
            expect(form.questions[2].questionType).toBe('select');
        });

        test('should chain methods', () => {
            const form = new FormBuilder()
                .title('Chain Test')
                .description('Desc')
                .metadata('test', 'value')
                .textQuestion('Q1', false)
                .build();

            expect(form.title).toBe('Chain Test');
            expect(form.description).toBe('Desc');
            expect(form.metadata.test).toBe('value');
            expect(form.questions).toHaveLength(1);
        });
    });

    describe('FormTemplates: Predefined Patterns', () => {
        test('should create contact form template', () => {
            const template = FormTemplates.contactForm();
            expect(template.title).toBeTruthy();
            expect(template.questions.length).toBeGreaterThan(0);
        });

        test('should create feedback form template', () => {
            const template = FormTemplates.feedbackForm();
            expect(template.title).toBe('Feedback Survey');
            expect(template.questions.length).toBeGreaterThan(0);
        });

        test('should create registration form template', () => {
            const template = FormTemplates.registrationForm();
            expect(template.title).toBeTruthy();
            expect(template.questions.length).toBeGreaterThan(0);
        });

        test('should create event registration template', () => {
            const template = FormTemplates.eventRegistration();
            expect(template.title).toBeTruthy();
            expect(template.questions.length).toBeGreaterThan(0);
        });

        test('should create job application template', () => {
            const template = FormTemplates.jobApplication();
            expect(template.title).toBeTruthy();
            expect(template.questions.length).toBeGreaterThan(0);
        });

        test('should templates have consistent structure', () => {
            const templates = [
                FormTemplates.contactForm(),
                FormTemplates.feedbackForm(),
                FormTemplates.registrationForm(),
                FormTemplates.eventRegistration(),
                FormTemplates.jobApplication(),
            ];

            templates.forEach(t => {
                expect(t).toHaveProperty('title');
                expect(t).toHaveProperty('questions');
                expect(Array.isArray(t.questions)).toBe(true);
            });
        });
    });

    describe('ValidationHelpers: Validation Methods', () => {
        test('should validate email', () => {
            const valid = ValidationHelpers.isValidEmail('test@example.com');
            const invalid = ValidationHelpers.isValidEmail('invalid');
            expect(valid).toBe(true);
            expect(invalid).toBe(false);
        });

        test('should validate phone', () => {
            const valid = ValidationHelpers.isValidPhone('+1234567890');
            const invalid = ValidationHelpers.isValidPhone('invalid');
            expect(valid).toBe(true);
            expect(invalid).toBe(false);
        });

        test('should validate date', () => {
            const valid = ValidationHelpers.isValidDate('2025-12-28');
            const invalid = ValidationHelpers.isValidDate('invalid');
            expect(valid).toBe(true);
            expect(invalid).toBe(false);
        });

        test('should validate submission data', () => {
            const form = {
                questions: [
                    { questionText: 'Email', questionType: 'email', required: true },
                    { questionText: 'Message', questionType: 'text', required: false },
                ],
            };

            const valid = { Email: 'test@example.com', Message: 'Hello' };
            const invalid = { Email: 'not-an-email' };

            const validErrors = ValidationHelpers.validateSubmissionData(valid, form);
            const invalidErrors = ValidationHelpers.validateSubmissionData(invalid, form);

            expect(validErrors).toHaveLength(0);
            expect(invalidErrors.length).toBeGreaterThan(0);
        });

        test('should validate select options', () => {
            const form = {
                questions: [
                    {
                        questionText: 'Choice',
                        questionType: 'select',
                        required: true,
                        options: ['A', 'B', 'C'],
                    },
                ],
            };

            const valid = { Choice: 'A' };
            const invalid = { Choice: 'D' };

            const validErrors = ValidationHelpers.validateSubmissionData(valid, form);
            const invalidErrors = ValidationHelpers.validateSubmissionData(invalid, form);

            expect(validErrors).toHaveLength(0);
            expect(invalidErrors.length).toBeGreaterThan(0);
        });

        test('should validate required fields', () => {
            const form = {
                questions: [
                    { questionText: 'Name', questionType: 'text', required: true },
                ],
            };

            const empty = { Name: '' };
            const filled = { Name: 'John' };

            const emptyErrors = ValidationHelpers.validateSubmissionData(empty, form);
            const filledErrors = ValidationHelpers.validateSubmissionData(filled, form);

            expect(emptyErrors.length).toBeGreaterThan(0);
            expect(filledErrors).toHaveLength(0);
        });

        test('should validate multiselect options', () => {
            const form = {
                questions: [
                    {
                        questionText: 'Features',
                        questionType: 'multiselect',
                        required: false,
                        options: ['A', 'B', 'C'],
                    },
                ],
            };

            const valid = { Features: ['A', 'B'] };

            const validErrors = ValidationHelpers.validateSubmissionData(valid, form);
            expect(validErrors).toHaveLength(0);
        });

        test('should validate rating values', () => {
            const form = {
                questions: [
                    { questionText: 'Rating', questionType: 'rating', required: true, options: [1, 2, 3, 4, 5] },
                ],
            };

            const valid = { Rating: 3 };
            const invalid = { Rating: 10 };

            const validErrors = ValidationHelpers.validateSubmissionData(valid, form);
            const invalidErrors = ValidationHelpers.validateSubmissionData(invalid, form);

            expect(validErrors).toHaveLength(0);
            expect(invalidErrors.length).toBeGreaterThan(0);
        });
    });

    describe('Integration: Builder + Templates + Validation', () => {
        test('should build form from template', () => {
            const template = FormTemplates.feedbackForm();
            const custom = new FormBuilder()
                .title('Custom ' + template.title)
                .description('Custom version')
                .textQuestion('Q1', false)
                .build();

            expect(custom.title).toContain('Custom');
            expect(custom.questions.length).toBeGreaterThan(0);
        });

        test('should validate custom form submission', () => {
            const form = {
                questions: [
                    { questionText: 'Name', questionType: 'text', required: true },
                    { questionText: 'Email', questionType: 'email', required: true },
                ],
            };

            const valid = { Name: 'John', Email: 'john@example.com' };
            const invalid = { Name: 'John', Email: 'invalid' };

            const validErrors = ValidationHelpers.validateSubmissionData(valid, form);
            const invalidErrors = ValidationHelpers.validateSubmissionData(invalid, form);

            expect(validErrors).toHaveLength(0);
            expect(invalidErrors.length).toBeGreaterThan(0);
        });

        test('should handle complex validations', () => {
            const form = {
                questions: [
                    { questionText: 'Name', questionType: 'text', required: true },
                    {
                        questionText: 'Type',
                        questionType: 'select',
                        required: true,
                        options: ['A', 'B'],
                    },
                    { questionText: 'Email', questionType: 'email', required: true },
                ],
            };

            const valid = { Name: 'Test', Type: 'A', Email: 'test@example.com' };
            const errors = ValidationHelpers.validateSubmissionData(valid, form);

            expect(errors).toHaveLength(0);
        });
    });
});
