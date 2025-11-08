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
const submission = await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Full Name': 'John Doe',
    'Email Address': 'john@example.com',
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
});
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
