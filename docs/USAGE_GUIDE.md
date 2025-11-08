# CheckOps Usage Guide

This guide provides detailed examples and best practices for using CheckOps.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Forms](#creating-forms)
3. [Using Question Bank](#using-question-bank)
4. [Managing Submissions](#managing-submissions)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)

## Getting Started

### Installation

```bash
npm install @saiqa-tech/checkops pg
```

### Database Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE checkops;
```

2. Set environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=checkops
export DB_USER=postgres
export DB_PASSWORD=your_password
```

3. Run migrations:

```bash
npm run migrate
```

### Initialize CheckOps

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await checkops.initialize();
```

## Creating Forms

### Basic Form

```javascript
const form = await checkops.createForm({
  title: 'Contact Form',
  description: 'Get in touch with us',
  questions: [
    {
      questionText: 'Your Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Your Email',
      questionType: 'email',
      required: true,
    },
    {
      questionText: 'Message',
      questionType: 'textarea',
      required: true,
    },
  ],
});
```

### Form with Validation Rules

```javascript
const form = await checkops.createForm({
  title: 'User Registration',
  questions: [
    {
      questionText: 'Username',
      questionType: 'text',
      required: true,
      validationRules: {
        minLength: 3,
        maxLength: 20,
      },
    },
    {
      questionText: 'Age',
      questionType: 'number',
      required: true,
      validationRules: {
        min: 18,
        max: 120,
      },
    },
  ],
});
```

### Form with Select Options

```javascript
const form = await checkops.createForm({
  title: 'Survey Form',
  questions: [
    {
      questionText: 'Select your country',
      questionType: 'select',
      required: true,
      options: ['USA', 'Canada', 'UK', 'Australia'],
    },
    {
      questionText: 'Select your interests',
      questionType: 'multiselect',
      required: false,
      options: ['Sports', 'Music', 'Reading', 'Travel'],
    },
  ],
});
```

### Form with Rating

```javascript
const form = await checkops.createForm({
  title: 'Feedback Form',
  questions: [
    {
      questionText: 'How would you rate our service?',
      questionType: 'rating',
      required: true,
      options: [1, 2, 3, 4, 5],
    },
  ],
});
```

## Using Question Bank

### Create Reusable Questions

```javascript
// Create questions in the question bank
const nameQuestion = await checkops.createQuestion({
  questionText: 'Full Name',
  questionType: 'text',
  metadata: { category: 'personal-info' },
});

const emailQuestion = await checkops.createQuestion({
  questionText: 'Email Address',
  questionType: 'email',
  metadata: { category: 'contact' },
});

const phoneQuestion = await checkops.createQuestion({
  questionText: 'Phone Number',
  questionType: 'phone',
  metadata: { category: 'contact' },
});
```

### Use Questions from Bank in Forms

```javascript
const form = await checkops.createForm({
  title: 'Registration Form',
  questions: [
    {
      questionId: nameQuestion.id,
      required: true,
    },
    {
      questionId: emailQuestion.id,
      required: true,
    },
    {
      questionId: phoneQuestion.id,
      required: false,
    },
  ],
});
```

### Override Question Properties

```javascript
const form = await checkops.createForm({
  title: 'Custom Form',
  questions: [
    {
      questionId: nameQuestion.id,
      questionText: 'Your Full Legal Name',
      required: true,
      metadata: { customField: 'value' },
    },
  ],
});
```

### Search Questions by Type

```javascript
// Get all email questions
const emailQuestions = await checkops.getAllQuestions({
  questionType: 'email',
  isActive: true,
});

// Get all active questions with pagination
const questions = await checkops.getAllQuestions({
  isActive: true,
  limit: 50,
  offset: 0,
});
```

## Managing Submissions

### Create Submission

```javascript
const submission = await checkops.createSubmission({
  formId: form.id,
  submissionData: {
    'Full Name': 'John Doe',
    'Email Address': 'john@example.com',
    'Phone Number': '+1234567890',
  },
  metadata: {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    submittedBy: req.user.id,
  },
});
```

### Retrieve Submissions

```javascript
// Get all submissions for a form
const submissions = await checkops.getSubmissionsByForm(form.id, {
  limit: 100,
  offset: 0,
});

// Get a specific submission
const submission = await checkops.getSubmission('SUB-001');

// Get all submissions (across all forms)
const allSubmissions = await checkops.getAllSubmissions({
  limit: 50,
  offset: 0,
});
```

### Update Submission

```javascript
const updated = await checkops.updateSubmission('SUB-001', {
  submissionData: {
    'Full Name': 'Jane Doe',
    'Email Address': 'jane@example.com',
  },
});
```

### Delete Submission

```javascript
await checkops.deleteSubmission('SUB-001');
```

### Get Submission Statistics

```javascript
const stats = await checkops.getSubmissionStats(form.id);

console.log('Total Submissions:', stats.totalSubmissions);

Object.keys(stats.questionStats).forEach((questionId) => {
  const qStats = stats.questionStats[questionId];
  console.log(`\nQuestion: ${qStats.questionText}`);
  console.log(`Total Answers: ${qStats.totalAnswers}`);
  console.log(`Empty Answers: ${qStats.emptyAnswers}`);
  console.log(`Unique Answers: ${qStats.uniqueAnswerCount}`);
  console.log('Answer Frequency:', qStats.answerFrequency);
});
```

## Advanced Features

### Conditional Forms

```javascript
// Create different forms based on user type
const userType = req.user.type;

let form;
if (userType === 'premium') {
  form = await checkops.getForm('FORM-001'); // Premium form
} else {
  form = await checkops.getForm('FORM-002'); // Basic form
}
```

### Bulk Operations

```javascript
// Create multiple questions at once
const questions = await Promise.all([
  checkops.createQuestion({
    questionText: 'First Name',
    questionType: 'text',
  }),
  checkops.createQuestion({
    questionText: 'Last Name',
    questionType: 'text',
  }),
  checkops.createQuestion({
    questionText: 'Company',
    questionType: 'text',
  }),
]);

// Use them in a form
const form = await checkops.createForm({
  title: 'Business Contact Form',
  questions: questions.map((q) => ({
    questionId: q.id,
    required: true,
  })),
});
```

### Export Submissions

```javascript
// Get all submissions and convert to CSV
const submissions = await checkops.getSubmissionsByForm(form.id);

const csvData = submissions.map((sub) => ({
  id: sub.id,
  submittedAt: sub.submittedAt,
  ...sub.submissionData,
}));

// Use a CSV library to export
import { stringify } from 'csv-stringify/sync';
const csv = stringify(csvData, { header: true });
```

### Form Versioning

```javascript
// Create a new version of a form
const originalForm = await checkops.getForm('FORM-001');

const newVersion = await checkops.createForm({
  title: `${originalForm.title} v2`,
  description: originalForm.description,
  questions: [
    ...originalForm.questions,
    {
      questionText: 'New Question',
      questionType: 'text',
    },
  ],
  metadata: {
    version: 2,
    previousVersion: originalForm.id,
  },
});

// Deactivate old version
await checkops.deactivateForm(originalForm.id);
```

### Pagination Helper

```javascript
async function getAllSubmissionsWithPagination(formId) {
  const allSubmissions = [];
  const pageSize = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const submissions = await checkops.getSubmissionsByForm(formId, {
      limit: pageSize,
      offset,
    });

    allSubmissions.push(...submissions);

    if (submissions.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }

  return allSubmissions;
}
```

## Best Practices

### 1. Always Initialize Before Use

```javascript
const checkops = new CheckOps(config);
await checkops.initialize();

// Now safe to use
```

### 2. Close Connection When Done

```javascript
// At application shutdown
process.on('SIGTERM', async () => {
  await checkops.close();
  process.exit(0);
});
```

### 3. Use Environment Variables

```javascript
// Never hardcode credentials
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production',
});
```

### 4. Handle Errors Properly

```javascript
import { errors } from '@saiqa-tech/checkops';

try {
  const submission = await checkops.createSubmission({
    formId: 'FORM-001',
    submissionData: data,
  });
} catch (error) {
  if (error instanceof errors.ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details,
    });
  } else if (error instanceof errors.NotFoundError) {
    return res.status(404).json({
      error: 'Form not found',
    });
  } else {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
```

### 5. Use Transactions for Related Operations

When creating multiple related entities, the library handles transactions internally. But for complex operations, consider using the underlying models directly if needed.

### 6. Implement Caching

```javascript
// Cache frequently accessed forms
const formCache = new Map();

async function getCachedForm(formId) {
  if (formCache.has(formId)) {
    return formCache.get(formId);
  }

  const form = await checkops.getForm(formId);
  formCache.set(formId, form);

  return form;
}
```

### 7. Validate Before Submission

```javascript
// Client-side validation
function validateBeforeSubmit(form, data) {
  const errors = [];

  form.questions.forEach((question) => {
    const value = data[question.questionText];

    if (question.required && !value) {
      errors.push(`${question.questionText} is required`);
    }

    if (question.questionType === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`${question.questionText} must be a valid email`);
      }
    }
  });

  return errors;
}
```

### 8. Use Metadata Effectively

```javascript
// Store useful metadata
const submission = await checkops.createSubmission({
  formId: form.id,
  submissionData: data,
  metadata: {
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    referrer: req.headers.referer,
    timestamp: new Date().toISOString(),
    sessionId: req.session.id,
  },
});
```

### 9. Implement Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many submissions, please try again later',
});

app.post('/submit', submissionLimiter, async (req, res) => {
  // Handle submission
});
```

### 10. Monitor Performance

```javascript
// Log slow operations
const startTime = Date.now();

const submissions = await checkops.getSubmissionsByForm(formId);

const duration = Date.now() - startTime;
if (duration > 1000) {
  console.warn(`Slow query: ${duration}ms for form ${formId}`);
}
```
