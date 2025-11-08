# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added

#### Core Features
- Initial release of CheckOps npm package
- Form builder with dynamic question support
- Centralized question bank for reusability
- Structured data submission with validation
- PostgreSQL 18 with JSONB support
- Human-readable ID generation (FORM-001, Q-001, SUB-001)

#### Question Types
- text - Single-line text input
- textarea - Multi-line text input
- number - Numeric input with validation
- email - Email input with validation
- phone - Phone number input
- date - Date picker
- time - Time picker
- datetime - Date and time picker
- select - Single-choice dropdown
- multiselect - Multiple-choice dropdown
- radio - Radio button group
- checkbox - Checkbox group
- boolean - Yes/No toggle
- file - File upload placeholder
- rating - Rating scale

#### API Methods
- Form Operations
  - `createForm()` - Create new forms
  - `getForm()` - Retrieve form by ID
  - `getAllForms()` - List all forms with pagination
  - `updateForm()` - Update existing forms
  - `deleteForm()` - Delete forms
  - `activateForm()` / `deactivateForm()` - Toggle form status
  - `getFormCount()` - Get total form count

- Question Bank Operations
  - `createQuestion()` - Add questions to bank
  - `getQuestion()` - Retrieve question by ID
  - `getQuestions()` - Retrieve multiple questions
  - `getAllQuestions()` - List all questions with filters
  - `updateQuestion()` - Update questions
  - `deleteQuestion()` - Delete questions
  - `activateQuestion()` / `deactivateQuestion()` - Toggle question status
  - `getQuestionCount()` - Get question count

- Submission Operations
  - `createSubmission()` - Submit form responses
  - `getSubmission()` - Retrieve submission by ID
  - `getSubmissionsByForm()` - Get all submissions for a form
  - `getAllSubmissions()` - List all submissions
  - `updateSubmission()` - Update submissions
  - `deleteSubmission()` - Delete submissions
  - `getSubmissionCount()` - Get submission count
  - `getSubmissionStats()` - Get submission analytics

#### Security Features
- Parameterized SQL queries (SQL injection prevention)
- Input sanitization (XSS prevention)
- HTML entity encoding
- Validation for all inputs
- Custom error classes with safe error messages

#### Database Features
- PostgreSQL 18 support
- JSONB columns with GIN indexes
- Automatic timestamp management
- Foreign key constraints with cascade delete
- Transaction support for data integrity
- Counter-based ID generation

#### Developer Experience
- ES Module support
- Comprehensive API documentation
- Usage guide with real-world examples
- Database schema documentation
- Architecture documentation
- Security best practices guide
- Contributing guidelines

#### Testing
- Unit tests for utilities
- Service layer tests
- Integration test framework
- Test coverage reporting
- 69 passing tests

### Documentation
- Complete API reference
- Usage guide with examples
- Real-world implementation examples
- Database schema documentation
- System architecture overview
- Security best practices
- Contributing guide

### Migration Scripts
- `001_create_forms_table.sql`
- `002_create_question_bank_table.sql`
- `003_create_submissions_table.sql`
- `004_create_id_counters.sql`

### Notes
- Requires Node.js 24+
- Requires PostgreSQL 18+
- Peer dependency: `pg` package
- Licensed under Apache 2.0

[1.0.0]: https://github.com/saiqa-tech/checkops/releases/tag/v1.0.0
