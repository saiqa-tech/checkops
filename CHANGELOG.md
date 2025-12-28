# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-01-28

### Added
- **Kiro Power Integration** - Complete Kiro Power package for seamless CheckOps integration
  - Interactive setup script with database configuration
  - Automated dependency installation (`@saiqa-tech/checkops`, `pg`)
  - Environment file generation with PostgreSQL settings
  - Database migration automation
  - Sample code generation for quick start
- **Enhanced Wrapper Library** - Production-ready wrapper with advanced features
  - `CheckOpsWrapper` class with retry logic, caching, and metrics
  - Event-driven architecture with operation tracking
  - Automatic reconnection and error handling
  - Built-in health checks and performance monitoring
- **Express.js Integration** - Complete middleware and routing solution
  - Pre-built Express middleware for CheckOps integration
  - RESTful API endpoints for forms, submissions, and statistics
  - Error handling middleware with proper HTTP status codes
  - Rate limiting and security middleware integration
- **Comprehensive Examples** - Real-world usage patterns
  - Basic usage examples with form creation and submissions
  - Advanced patterns with caching, bulk operations, and analytics
  - Express.js integration with complete server setup
  - Production deployment examples with Docker and Kubernetes
- **Steering Guides** - Detailed workflow documentation
  - Getting started guide for new users
  - Form creation best practices
  - Question management workflows
  - Error handling patterns
  - Production deployment guide with security and performance optimization

### Enhanced
- **Documentation Coverage** - Comprehensive JSDoc comments (80%+ coverage)
  - Detailed parameter documentation with types
  - Return value specifications
  - Error condition documentation
  - Event emission documentation
- **Security Improvements** - Production-ready security features
  - SSL/TLS configuration examples
  - Input validation and sanitization
  - SQL injection prevention
  - XSS protection
  - Rate limiting implementation
- **Performance Optimization** - Production-grade performance features
  - Connection pooling configuration
  - Caching strategies with Redis integration
  - Database query optimization
  - Memory leak prevention
  - Metrics collection and monitoring

### Fixed
- **Code Quality** - Resolved all critical issues identified in code review
  - Fixed memory leaks in wrapper cleanup
  - Resolved async/await syntax errors
  - Fixed switch case scope issues
  - Cleaned up orphaned code
  - Removed unused imports
- **Security Vulnerabilities** - Addressed security concerns
  - Fixed CSV injection vulnerabilities in utilities
  - Corrected SSL configuration examples
  - Enhanced input validation
  - Improved error handling

### Developer Experience
- **MCP Server** - Model Context Protocol server for Kiro integration
  - Database connection testing
  - Form and question management tools
  - Submission handling and analytics
  - Health monitoring capabilities
- **Package Scripts** - Convenient npm scripts for common tasks
  - `npm run setup` - Interactive setup wizard
  - `npm run example:basic` - Run basic usage examples
  - `npm run example:express` - Start Express integration demo
  - `npm run example:advanced` - Run advanced pattern examples

### Deployment
- **Docker Support** - Complete containerization setup
  - Multi-stage Dockerfile for production
  - Docker Compose configuration
  - Health checks and monitoring
  - Security best practices
- **Kubernetes Support** - Cloud-native deployment
  - Deployment manifests
  - Service configuration
  - ConfigMap and Secret management
  - Horizontal Pod Autoscaling

### Notes
- Fully backward compatible with v2.0.0
- Enhanced wrapper library provides additional features while maintaining core API
- Kiro Power enables zero-configuration setup for new projects
- Production deployment guides ensure secure and scalable deployments

## [2.0.0] - 2025-01-16

### Added
- **Option Key-Value System** - Stable data integrity for option-based questions
  - Automatic key generation for simple option arrays
  - Support for structured options with custom keys and labels
  - Option keys remain stable when labels change
  - Full backward compatibility with simple string arrays
- **New API Methods**
  - `updateOptionLabel()` - Update option labels without affecting data integrity
  - `getOptionHistory()` - Track all label changes for options
- **Option History Tracking**
  - New `question_option_history` table to audit label changes
  - Track who changed labels and when
  - Optional change reason field
- **Enhanced OptionUtils Class**
  - `processOptions()` - Convert simple arrays or validate structured options
  - `generateOptionKey()` - Create unique, readable keys
  - `sanitizeOptionKey()` - Validate and clean option keys
  - `findOption()` - Find option by key OR label
  - `convertToKeys()` - Transform labels to keys for storage
  - `convertToLabels()` - Transform keys to labels for display
  - `requiresOptions()` - Check if question type needs options
  - `isValidAnswer()` - Validate answers against options
- **Automatic Key/Label Conversion**
  - Submissions accept both keys and labels
  - Stored responses use stable keys
  - Retrieved responses display current labels
  - Stats aggregate by key, display by current label

### Changed
- **Breaking Change**: Options structure now supports both simple arrays and structured objects
  - Simple arrays: `['Red', 'Blue', 'Green']` (auto-converted to structured)
  - Structured: `[{ key: 'color_red', label: 'Red', ... }]`
- **Submission Data Storage**: Responses now stored using option keys instead of labels
- **Submission Retrieval**: Added `_rawData` field with original keys for processing
- **Stats Aggregation**: `answerDistribution` now shows current labels, `_keyDistribution` for internal tracking
- **Validation**: Updated to use OptionUtils for option-based question validation

### Database
- **Migration 002 Updated**: Added `unique_option_keys` CHECK constraint
  - Created `validate_unique_option_keys()` function
  - Ensures option keys are unique within each question
- **Migration 005 Added**: Created `question_option_history` table
  - Tracks all option label changes
  - Foreign key relationship to question_bank
  - Indexed for efficient querying

### Migration Guide

#### For Existing Users (v1.x → v2.0)

**Simple Arrays Still Work** (Backward Compatible):
```javascript
// This still works - automatically converted to structured format
await checkops.createQuestion({
  questionText: 'Select a color',
  questionType: 'select',
  options: ['Red', 'Blue', 'Green']
});
```

**Recommended: Use Structured Options**:
```javascript
// Better approach for production
await checkops.createQuestion({
  questionText: 'Select a color',
  questionType: 'select',
  options: [
    { key: 'color_red', label: 'Red' },
    { key: 'color_blue', label: 'Blue' },
    { key: 'color_green', label: 'Green' }
  ]
});
```

**Update Labels Without Breaking Data**:
```javascript
// Change label while preserving data integrity
await checkops.updateOptionLabel(
  'Q-001',
  'color_red',
  'Crimson Red',
  'admin@example.com'
);

// Track changes
const history = await checkops.getOptionHistory('Q-001', 'color_red');
```

**Submissions Accept Both Keys and Labels**:
```javascript
// All of these work
await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'color_red',  // Using key
    'Q-002': 'Blue',       // Using label (auto-converted to key)
  }
});
```

### Notes
- All existing data remains intact
- Simple arrays are automatically converted on first update
- Existing submissions will display with current labels
- Run migration 005 to enable option history tracking

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
