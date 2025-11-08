# CheckOps

A production-ready Node.js npm package that enables developers to create dynamic forms with centralized question reusability and structured data submission capabilities.

[![npm version](https://badge.fury.io/js/%40saiqa-tech%2Fcheckops.svg)](https://www.npmjs.com/package/@saiqa-tech/checkops)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Features

- 🎯 **Dynamic Form Builder** - Create forms with flexible question types
- 🔄 **Question Reusability** - Centralized question bank for reusing questions across forms
- 📊 **Structured Data Submission** - Validated and sanitized submission handling
- 🔐 **Security First** - Built-in input sanitization and parameterized queries
- 🚀 **PostgreSQL 18 + JSONB** - High-performance database with flexible schema
- 📈 **Submission Analytics** - Built-in statistics and reporting
- 🧪 **80%+ Test Coverage** - Comprehensive unit and integration tests
- 📖 **Well Documented** - Complete API reference and usage guides

## Installation

```bash
npm install @saiqa-tech/checkops pg
```

**Note:** CheckOps requires PostgreSQL 18 and the `pg` package as peer dependencies.

## Quick Start

### 1. Initialize Database

First, run the database migrations:

```bash
# Set your database credentials
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=your_database
export DB_USER=postgres
export DB_PASSWORD=your_password

# Run migrations
npm run migrate
```

### 2. Initialize CheckOps

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps({
  host: 'localhost',
  port: 5432,
  database: 'your_database',
  user: 'postgres',
  password: 'your_password',
});

await checkops.initialize();
```

### 3. Create a Form

```javascript
const form = await checkops.createForm({
  title: 'Customer Feedback Form',
  description: 'Please share your experience with us',
  questions: [
    {
      questionText: 'What is your name?',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'What is your email?',
      questionType: 'email',
      required: true,
    },
    {
      questionText: 'How would you rate our service?',
      questionType: 'rating',
      options: [1, 2, 3, 4, 5],
      required: true,
    },
  ],
});

console.log('Form created:', form.id);
```

### 4. Submit Responses

```javascript
const submission = await checkops.createSubmission({
  formId: form.id,
  submissionData: {
    'What is your name?': 'John Doe',
    'What is your email?': 'john@example.com',
    'How would you rate our service?': 5,
  },
});

console.log('Submission created:', submission.id);
```

### 5. Get Analytics

```javascript
const stats = await checkops.getSubmissionStats(form.id);
console.log('Total submissions:', stats.totalSubmissions);
console.log('Question statistics:', stats.questionStats);
```

## Supported Question Types

- **text** - Single-line text input
- **textarea** - Multi-line text input
- **number** - Numeric input
- **email** - Email input with validation
- **phone** - Phone number input
- **date** - Date picker
- **time** - Time picker
- **datetime** - Date and time picker
- **select** - Single-choice dropdown
- **multiselect** - Multiple-choice dropdown
- **radio** - Radio button group
- **checkbox** - Checkbox group
- **boolean** - Yes/No toggle
- **file** - File upload
- **rating** - Star rating or numeric rating

## Documentation

- [API Reference](./docs/API_REFERENCE.md) - Complete API documentation
- [Usage Guide](./docs/USAGE_GUIDE.md) - Detailed usage examples
- [Examples](./docs/EXAMPLES.md) - Real-world code examples
- [Database Schema](./docs/DATABASE_SCHEMA.md) - Database structure
- [Architecture](./docs/ARCHITECTURE.md) - System architecture
- [Security](./docs/SECURITY.md) - Security best practices

## Database Requirements

- PostgreSQL 18 or higher
- JSONB support (included in PostgreSQL 9.4+)
- Sufficient storage for form data

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [https://github.com/saiqa-tech/checkops/issues](https://github.com/saiqa-tech/checkops/issues)
- Documentation: [https://github.com/saiqa-tech/checkops](https://github.com/saiqa-tech/checkops)

## Roadmap

- [ ] Export submissions to CSV/Excel
- [ ] Form templates library
- [ ] Conditional logic for questions
- [ ] Multi-language support
- [ ] Email notifications
- [ ] Webhook integrations
- [ ] React/Vue components

## Authors

**Saiqa Tech** - [https://github.com/saiqa-tech](https://github.com/saiqa-tech)

## Acknowledgments

Built with ❤️ for the developer community.
