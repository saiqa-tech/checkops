# Getting Started with CheckOps

This guide walks you through setting up CheckOps in your Node.js project for dynamic form creation and submission handling.

## Prerequisites

- Node.js 24.0.0 or higher
- PostgreSQL 18 or higher
- Database credentials (host, port, database, user, password)

## Installation Steps

### 1. Install Dependencies

```bash
npm install @saiqa-tech/checkops pg
```

### 2. Environment Configuration

Create a `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### 3. Database Migration

Run the CheckOps migrations to set up the required tables:

```bash
npm run migrate
```

Or manually run:

```bash
node node_modules/@saiqa-tech/checkops/migrations/run.js
```

### 4. Initialize CheckOps

Create your main CheckOps instance:

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Initialize the connection
await checkops.initialize();
```

## Basic Usage Examples

### Creating Your First Form

```javascript
const form = await checkops.createForm({
  title: 'Customer Feedback Survey',
  description: 'Help us improve our services',
  questions: [
    {
      questionText: 'What is your name?',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'How would you rate our service?',
      questionType: 'rating',
      options: [1, 2, 3, 4, 5],
      required: true,
    },
    {
      questionText: 'Which services did you use?',
      questionType: 'multiselect',
      options: ['Support', 'Sales', 'Technical', 'Billing'],
      required: false,
    },
  ],
});

console.log('Form created with ID:', form.id);
```

### Handling Form Submissions

```javascript
const submission = await checkops.createSubmission({
  formId: form.id,
  submissionData: {
    'What is your name?': 'John Doe',
    'How would you rate our service?': 5,
    'Which services did you use?': ['Support', 'Technical'],
  },
});

console.log('Submission created with ID:', submission.id);
```

### Getting Analytics

```javascript
const stats = await checkops.getSubmissionStats(form.id);
console.log('Total submissions:', stats.totalSubmissions);
console.log('Question statistics:', stats.questionStats);
```

## Error Handling

Always wrap CheckOps operations in try-catch blocks:

```javascript
try {
  await checkops.initialize();
  const form = await checkops.createForm(formData);
} catch (error) {
  console.error('CheckOps error:', error.message);
  // Handle error appropriately
}
```

## Next Steps

- Review the [Form Creation Guide](./form-creation.md)
- Learn about [Question Management](./question-management.md)
- Explore [Production Deployment](./production-deployment.md)
- Check out [Error Handling](./error-handling.md) best practices