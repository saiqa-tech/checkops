# CheckOps API Reference

Complete API documentation for CheckOps npm package.

## Table of Contents

- [CheckOps Class](#checkops-class)
- [Form Operations](#form-operations)
- [Question Operations](#question-operations)
- [Submission Operations](#submission-operations)
- [Error Handling](#error-handling)

## CheckOps Class

### Constructor

```javascript
new CheckOps(config)
```

Creates a new CheckOps instance.

**Parameters:**

- `config` (Object) - Database configuration
  - `host` (String) - Database host (default: 'localhost')
  - `port` (Number) - Database port (default: 5432)
  - `database` (String) - Database name (default: 'checkops')
  - `user` (String) - Database user (default: 'postgres')
  - `password` (String) - Database password
  - `ssl` (Boolean|Object) - SSL configuration (default: false)
  - `max` (Number) - Max pool connections (default: 20)
  - `min` (Number) - Min pool connections (default: 2)
  - `idleTimeoutMillis` (Number) - Idle timeout (default: 30000)

**Example:**

```javascript
const checkops = new CheckOps({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'secret',
});
```

### initialize()

```javascript
await checkops.initialize()
```

Initializes the CheckOps instance and connects to the database.

**Returns:** `Promise<void>`

**Throws:** Error if initialization fails

### close()

```javascript
await checkops.close()
```

Closes the database connection and cleans up resources.

**Returns:** `Promise<void>`

## Form Operations

### createForm()

```javascript
await checkops.createForm(options)
```

Creates a new form.

**Parameters:**

- `options` (Object)
  - `title` (String, required) - Form title (1-255 characters)
  - `description` (String, optional) - Form description
  - `questions` (Array, required) - Array of question objects
  - `metadata` (Object, optional) - Additional metadata

**Question Object:**

```javascript
{
  questionId: 'Q-001',        // Optional: Reference to question bank
  questionText: 'Question?',   // Required if no questionId
  questionType: 'text',        // Required if no questionId
  required: true,              // Optional: default false
  options: [],                 // Optional: for select/radio/checkbox
  validationRules: {},         // Optional: validation rules
  metadata: {}                 // Optional: additional data
}
```

**Returns:** `Promise<Form>` - Created form object

**Example:**

```javascript
const form = await checkops.createForm({
  title: 'User Registration',
  description: 'New user registration form',
  questions: [
    {
      questionText: 'Full Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Email Address',
      questionType: 'email',
      required: true,
    },
  ],
});
```

### getForm()

```javascript
await checkops.getForm(id)
```

Retrieves a form by ID.

**Parameters:**

- `id` (String, required) - Form ID (e.g., 'FORM-001')

**Returns:** `Promise<Form>` - Form object

**Throws:** `NotFoundError` if form doesn't exist

### getAllForms()

```javascript
await checkops.getAllForms(options)
```

Retrieves all forms with optional filtering.

**Parameters:**

- `options` (Object, optional)
  - `isActive` (Boolean, optional) - Filter by active status
  - `limit` (Number, optional) - Max results (default: 100)
  - `offset` (Number, optional) - Offset for pagination (default: 0)

**Returns:** `Promise<Array<Form>>` - Array of form objects

### updateForm()

```javascript
await checkops.updateForm(id, updates)
```

Updates an existing form.

**Parameters:**

- `id` (String, required) - Form ID
- `updates` (Object, required) - Fields to update
  - `title` (String, optional)
  - `description` (String, optional)
  - `questions` (Array, optional)
  - `metadata` (Object, optional)
  - `isActive` (Boolean, optional)

**Returns:** `Promise<Form>` - Updated form object

### deleteForm()

```javascript
await checkops.deleteForm(id)
```

Deletes a form and all its submissions.

**Parameters:**

- `id` (String, required) - Form ID

**Returns:** `Promise<Form>` - Deleted form object

### deactivateForm() / activateForm()

```javascript
await checkops.deactivateForm(id)
await checkops.activateForm(id)
```

Deactivates or activates a form.

**Parameters:**

- `id` (String, required) - Form ID

**Returns:** `Promise<Form>` - Updated form object

### getFormCount()

```javascript
await checkops.getFormCount(options)
```

Gets the total count of forms.

**Parameters:**

- `options` (Object, optional)
  - `isActive` (Boolean, optional) - Filter by active status

**Returns:** `Promise<Number>` - Count of forms

## Question Operations

### createQuestion()

```javascript
await checkops.createQuestion(options)
```

Creates a new question in the question bank.

**Parameters:**

- `options` (Object)
  - `questionText` (String, required) - Question text (1-5000 characters)
  - `questionType` (String, required) - Question type
  - `options` (Array, optional) - Options for select/radio/checkbox
  - `validationRules` (Object, optional) - Validation rules
  - `metadata` (Object, optional) - Additional metadata

**Returns:** `Promise<Question>` - Created question object

**Example:**

```javascript
const question = await checkops.createQuestion({
  questionText: 'Select your country',
  questionType: 'select',
  options: ['USA', 'Canada', 'UK', 'Australia'],
  metadata: { category: 'demographics' },
});

// Options with structured format (recommended for complex cases)
const questionWithStructuredOptions = await checkops.createQuestion({
  questionText: 'Select priority',
  questionType: 'select',
  options: [
    { key: 'priority_high', label: 'High Priority', metadata: { color: 'red' } },
    { key: 'priority_low', label: 'Low Priority', metadata: { color: 'green' } }
  ],
});

// Security Note: Option labels and metadata are automatically sanitized
// to prevent XSS attacks and prototype pollution
```

### getQuestion()

```javascript
await checkops.getQuestion(id)
```

Retrieves a question by ID.

**Parameters:**

- `id` (String, required) - Question ID (e.g., 'Q-001')

**Returns:** `Promise<Question>` - Question object

### getQuestions()

```javascript
await checkops.getQuestions(ids)
```

Retrieves multiple questions by IDs.

**Parameters:**

- `ids` (Array<String>, required) - Array of question IDs

**Returns:** `Promise<Array<Question>>` - Array of question objects

### getAllQuestions()

```javascript
await checkops.getAllQuestions(options)
```

Retrieves all questions with optional filtering.

**Parameters:**

- `options` (Object, optional)
  - `questionType` (String, optional) - Filter by question type
  - `isActive` (Boolean, optional) - Filter by active status
  - `limit` (Number, optional) - Max results (default: 100)
  - `offset` (Number, optional) - Offset for pagination (default: 0)

**Returns:** `Promise<Array<Question>>` - Array of question objects

### updateQuestion()

```javascript
await checkops.updateQuestion(id, updates)
```

Updates an existing question.

**Parameters:**

- `id` (String, required) - Question ID
- `updates` (Object, required) - Fields to update

**Returns:** `Promise<Question>` - Updated question object

### updateOptionLabel()

```javascript
await checkops.updateOptionLabel(questionId, optionKey, newLabel, changedBy)
```

Updates a single option label with full transaction safety and history tracking.

**Parameters:**

- `questionId` (String, required) - Question ID
- `optionKey` (String, required) - Option key to update
- `newLabel` (String, required) - New label text (1-500 characters)
- `changedBy` (String, optional) - User ID who made the change

**Returns:** `Promise<Question>` - Updated question object

**Important Notes:**
- Uses row-level locking (SELECT FOR UPDATE) to prevent race conditions
- Automatically invalidates stats cache for all forms using this question
- Records change in option history for audit purposes
- Maintains key immutability (only label changes)

**Example:**

```javascript
await checkops.updateOptionLabel(
  'Q-001',
  'priority_high',
  'Critical Priority',
  'user-123'
);
```

### deleteQuestion()

```javascript
await checkops.deleteQuestion(id)
```

Deletes a question from the question bank.

**Parameters:**

- `id` (String, required) - Question ID

**Returns:** `Promise<Question>` - Deleted question object

## Submission Operations

### createSubmission()

```javascript
await checkops.createSubmission(options)
```

Creates a new form submission.

**Parameters:**

- `options` (Object)
  - `formId` (String, required) - Form ID
  - `submissionData` (Object, required) - Submission data as key-value pairs
  - `metadata` (Object, optional) - Additional metadata

**Returns:** `Promise<Submission>` - Created submission object

**Example:**

```javascript
// Submissions use question IDs (from question bank or form questions)
const submission = await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'John Doe',        // Question ID from question bank
    'Q-002': 'john@example.com', // Question ID from question bank
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
});

// For select/multiselect questions, use option keys OR labels (both accepted)
const submissionWithOptions = await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-003': 'option_red',           // Option key (preferred)
    'Q-004': ['Red', 'Blue'],        // Option labels (converted to keys)
    'Q-005': ['option_a', 'option_b'] // Option keys for multiselect
  },
});

// Note: All option labels are sanitized against XSS on write
// Multiselect validation ensures all values are valid option keys/labels
```

### getSubmission()

```javascript
await checkops.getSubmission(id)
```

Retrieves a submission by ID.

**Parameters:**

- `id` (String, required) - Submission ID (e.g., 'SUB-001')

**Returns:** `Promise<Submission>` - Submission object

### getSubmissionsByForm()

```javascript
await checkops.getSubmissionsByForm(formId, options)
```

Retrieves all submissions for a form.

**Parameters:**

- `formId` (String, required) - Form ID
- `options` (Object, optional)
  - `limit` (Number, optional) - Max results (default: 100)
  - `offset` (Number, optional) - Offset for pagination (default: 0)

**Returns:** `Promise<Array<Submission>>` - Array of submission objects

### getAllSubmissions()

```javascript
await checkops.getAllSubmissions(options)
```

Retrieves all submissions across all forms.

**Parameters:**

- `options` (Object, optional)
  - `limit` (Number, optional) - Max results (default: 100)
  - `offset` (Number, optional) - Offset for pagination (default: 0)

**Returns:** `Promise<Array<Submission>>` - Array of submission objects

### updateSubmission()

```javascript
await checkops.updateSubmission(id, updates)
```

Updates an existing submission.

**Parameters:**

- `id` (String, required) - Submission ID
- `updates` (Object, required) - Fields to update

**Returns:** `Promise<Submission>` - Updated submission object

### deleteSubmission()

```javascript
await checkops.deleteSubmission(id)
```

Deletes a submission.

**Parameters:**

- `id` (String, required) - Submission ID

**Returns:** `Promise<Submission>` - Deleted submission object

### getSubmissionStats()

```javascript
await checkops.getSubmissionStats(formId)
```

Gets statistics for form submissions.

**Parameters:**

- `formId` (String, required) - Form ID

**Returns:** `Promise<Object>` - Statistics object

**Response Structure:**

```javascript
{
  totalSubmissions: 150,
  questionStats: {
    'q1': {
      questionText: 'Full Name',
      questionType: 'text',
      totalAnswers: 150,
      emptyAnswers: 0,
      uniqueAnswerCount: 145,
      answerFrequency: {
        'John Doe': 2,
        'Jane Smith': 3,
        ...
      }
    }
  }
}
```

## Error Handling

CheckOps uses custom error classes for better error handling:

### Error Classes

- `CheckOpsError` - Base error class
- `ValidationError` - Validation failed
- `NotFoundError` - Resource not found
- `DatabaseError` - Database operation failed
- `DuplicateError` - Duplicate entry
- `InvalidOperationError` - Invalid operation

**Example:**

```javascript
import CheckOps, { errors } from '@saiqa-tech/checkops';

try {
  await checkops.createForm({
    title: '',
    questions: [],
  });
} catch (error) {
  if (error instanceof errors.ValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Details:', error.details);
  } else if (error instanceof errors.DatabaseError) {
    console.error('Database error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Data Types

### Form Object

```javascript
{
  id: 'FORM-001',
  title: 'Form Title',
  description: 'Form description',
  questions: [...],
  metadata: {},
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}
```

### Question Object

```javascript
{
  id: 'Q-001',
  questionText: 'Question text',
  questionType: 'text',
  options: null,
  validationRules: null,
  metadata: {},
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}
```

### Submission Object

```javascript
{
  id: 'SUB-001',
  formId: 'FORM-001',
  submissionData: { ... },
  metadata: {},
  submittedAt: '2024-01-01T00:00:00Z'
}
```


## Performance Monitoring (v3.0.0)

### Metrics Collection

CheckOps v3.0.0 includes built-in performance monitoring.

```javascript
import CheckOps, { metricsCollector, productionMetrics } from '@saiqa-tech/checkops';
```

#### metricsCollector.getMetrics()

Get current performance metrics.

**Returns:** `Object` - Metrics object

**Response Structure:**

```javascript
{
  operations: Map<string, OperationStats>,
  batchOperations: Map<string, BatchStats>,
  cacheHits: number,
  cacheMisses: number,
  validations: ValidationStats,
  connections: ConnectionStats
}
```

**Example:**

```javascript
const metrics = metricsCollector.getMetrics();
console.log('Cache hit rate:', metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses));
```

#### metricsCollector.reset()

Reset all metrics to zero.

**Returns:** `void`

**Example:**

```javascript
metricsCollector.reset();
```

### Production Metrics

#### productionMetrics.recordOperation(name, duration)

Record a custom operation metric.

**Parameters:**
- `name` (String, required) - Operation name
- `duration` (Number, required) - Duration in milliseconds

**Example:**

```javascript
const start = Date.now();
await myOperation();
productionMetrics.recordOperation('myOperation', Date.now() - start);
```

#### productionMetrics.recordError(operation, error)

Record an error for an operation.

**Parameters:**
- `operation` (String, required) - Operation name
- `error` (Error, required) - Error object

**Example:**

```javascript
try {
  await checkops.createForm(data);
} catch (error) {
  productionMetrics.recordError('createForm', error);
  throw error;
}
```

### Health Checks

#### getHealthCheckData()

Get comprehensive health check data.

**Returns:** `Promise<Object>` - Health check object

**Example:**

```javascript
import { getHealthCheckData } from '@saiqa-tech/checkops';

const health = await getHealthCheckData();
console.log('System status:', health.status);
```

## Cache Management (v3.0.0)

### getCacheStats()

```javascript
checkops.getCacheStats()
```

Get cache performance statistics.

**Returns:** `Object` - Cache statistics

**Response Structure:**

```javascript
{
  forms: { size, hits, misses, hitRate, maxSize, evictions },
  questions: { size, hits, misses, hitRate, maxSize, evictions },
  stats: { size, hits, misses, hitRate, maxSize, evictions },
  submissions: { size, hits, misses, hitRate, maxSize, evictions },
  query: { size, hits, misses, hitRate, maxSize, evictions },
  total: { size, hits, misses, hitRate, maxSize, evictions }
}
```

**Example:**

```javascript
const cacheStats = checkops.getCacheStats();
console.log('Overall cache hit rate:', cacheStats.total.hitRate);
```

### clearCache()

```javascript
await checkops.clearCache(type, id)
```

Clear cache entries.

**Parameters:**
- `type` (String, optional) - Cache type: 'all', 'form', 'question', 'stats', 'submission'. Default: 'all'
- `id` (String, optional) - Specific ID to clear. If omitted, clears all entries of that type

**Returns:** `Promise<Object>` - Result message

**Examples:**

```javascript
// Clear all caches
await checkops.clearCache('all');

// Clear all form caches
await checkops.clearCache('form');

// Clear specific form cache
await checkops.clearCache('form', 'FORM-001');

// Clear all stats caches
await checkops.clearCache('stats');
```

## Batch Operations (v3.0.0)

### bulkCreateForms()

```javascript
await checkops.bulkCreateForms(formsData)
```

Create multiple forms in a single transaction.

**Parameters:**
- `formsData` (Array<Object>, required) - Array of form objects

**Returns:** `Promise<Array<Form>>` - Array of created forms

**Example:**

```javascript
const formsData = [
  {
    title: 'Form 1',
    description: 'Description 1',
    questions: [...]
  },
  {
    title: 'Form 2',
    description: 'Description 2',
    questions: [...]
  }
];

const forms = await checkops.bulkCreateForms(formsData);
console.log(`Created ${forms.length} forms`);
```

**Performance:** 10-20x faster than individual creates for 100+ forms.

### bulkCreateQuestions()

```javascript
await checkops.bulkCreateQuestions(questionsData)
```

Create multiple questions in a single transaction.

**Parameters:**
- `questionsData` (Array<Object>, required) - Array of question objects

**Returns:** `Promise<Array<Question>>` - Array of created questions

**Example:**

```javascript
const questionsData = [
  {
    questionText: 'Full Name',
    questionType: 'text',
    metadata: { category: 'personal' }
  },
  {
    questionText: 'Email',
    questionType: 'email',
    metadata: { category: 'contact' }
  }
];

const questions = await checkops.bulkCreateQuestions(questionsData);
```

**Performance:** 15-25x faster than individual creates for 100+ questions.

### bulkCreateSubmissions()

```javascript
await checkops.bulkCreateSubmissions(submissionsData)
```

Create multiple submissions in a single transaction.

**Parameters:**
- `submissionsData` (Array<Object>, required) - Array of submission objects

**Returns:** `Promise<Array<Submission>>` - Array of created submissions

**Example:**

```javascript
const submissionsData = [
  {
    formId: 'FORM-001',
    submissionData: {
      'Q-001': 'John Doe',
      'Q-002': 'john@example.com'
    },
    metadata: { source: 'import' }
  },
  {
    formId: 'FORM-001',
    submissionData: {
      'Q-001': 'Jane Smith',
      'Q-002': 'jane@example.com'
    },
    metadata: { source: 'import' }
  }
];

const submissions = await checkops.bulkCreateSubmissions(submissionsData);
```

**Performance:** 10-20x faster than individual creates for 100+ submissions.

**Note:** All batch operations are transactional - if any item fails, all are rolled back.

## MCP Server Integration (v3.0.0)

CheckOps v3.0.0 includes a Model Context Protocol (MCP) server for AI development tools.

### Installation

The MCP server is included with the CheckOps package:

```bash
npm install -g @saiqa-tech/checkops
```

### Running the MCP Server

```bash
# Direct execution
checkops-mcp-server

# Or via npx
npx --package=@saiqa-tech/checkops@latest checkops-mcp-server
```

### Configuration

Set environment variables for database connection:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=checkops
export DB_USER=postgres
export DB_PASSWORD=your_password
```

### Available MCP Tools

The MCP server exposes 17 tools:

**Core Operations:**
- `checkops_test_connection`
- `checkops_create_form`
- `checkops_get_forms`
- `checkops_create_submission`
- `checkops_get_submissions`
- `checkops_get_stats`
- `checkops_create_question`
- `checkops_get_questions`

**Performance Monitoring:**
- `checkops_start_monitoring`
- `checkops_get_metrics`
- `checkops_get_health_status`
- `checkops_get_performance_trends`

**Batch Operations:**
- `checkops_bulk_create_forms`
- `checkops_bulk_create_submissions`
- `checkops_bulk_create_questions`

**Cache Management:**
- `checkops_get_cache_stats`
- `checkops_clear_cache`

For detailed MCP server documentation, see [MCP_SERVER_IMPLEMENTATION.md](../MCP_SERVER_IMPLEMENTATION.md).

## Monitoring Wrappers (v3.0.0)

### withMonitoring()

Wrap any async function with automatic performance monitoring.

```javascript
import { withMonitoring } from '@saiqa-tech/checkops';

const monitoredFunction = withMonitoring('operationName', async (data) => {
  // Your logic here
  return await processData(data);
});

// Metrics automatically collected
const result = await monitoredFunction(myData);
```

### withModelMonitoring()

Wrap model methods with monitoring.

```javascript
import { withModelMonitoring } from '@saiqa-tech/checkops';

class CustomModel {
  static async create(data) {
    return withModelMonitoring('CustomModel', 'create', async () => {
      return await db.insert(data);
    });
  }
}
```

### recordBatchOperation()

Monitor batch operations with size tracking.

```javascript
import { recordBatchOperation } from '@saiqa-tech/checkops';

const bulkInsert = recordBatchOperation('bulkInsert', 100, async (records) => {
  return await db.insertMany(records);
});

await bulkInsert(myRecords);
```

## Version History

### v3.0.0 (Current)

**New Features:**
- Performance monitoring and metrics collection
- Batch operations (bulk create)
- Cache management APIs
- MCP server integration
- Health check endpoints
- Monitoring wrappers

**Breaking Changes:**
- None (fully backward compatible)

### v2.1.0

**New Features:**
- Option key-value system
- Option label update with history tracking
- Stats cache invalidation

### v2.0.0

**New Features:**
- Question bank
- Form-question relationship
- Centralized question reusability

For complete version history, see [CHANGELOG.md](../CHANGELOG.md).
