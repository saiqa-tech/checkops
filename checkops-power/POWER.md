# CheckOps Power

A comprehensive Kiro Power for integrating CheckOps - a production-ready Node.js package for creating dynamic forms with centralized question reusability and structured data submission capabilities.

## Activation Keywords

This power activates when you mention any of these keywords:
- `checkops`
- `ops checks`
- `database monitoring`
- `checkops init`
- `form builder`
- `dynamic forms`
- `submission handling`

## What This Power Does

The CheckOps Power provides:

1. **Automated Setup**: Installs `@saiqa-tech/checkops` and `pg` dependencies
2. **Configuration Scaffolding**: Creates `.env` files with PostgreSQL connection settings
3. **Database Migration**: Runs CheckOps database migrations automatically
4. **Code Generation**: Generates sample initialization and usage code
5. **Best Practices**: Provides steering guides for common workflows
6. **Validation**: Tests database connections and validates setup

## Quick Start

When activated, this power will:

1. Install CheckOps package: `npm install @saiqa-tech/checkops pg`
2. Create environment configuration with database credentials
3. Generate initialization code for your project
4. Run database migrations
5. Provide sample form creation and submission code

## Database Requirements

CheckOps requires:
- PostgreSQL 18 or higher
- JSONB support (PostgreSQL 9.4+)
- Database credentials (host, port, database, user, password)

## Core Features

### Dynamic Form Builder
Create forms with flexible question types including text, email, select, multiselect, rating, and more.

### Question Reusability
Centralized question bank allows reusing questions across multiple forms.

### Stable Option Keys
Option key-value system prevents data misalignment when labels change over time.

### Security First
Built-in input sanitization and parameterized queries for production safety.

### Analytics & Reporting
Built-in submission statistics and reporting capabilities.

## Configuration Example

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await checkops.initialize();
```

## Common Workflows

1. **Form Creation**: Create dynamic forms with various question types
2. **Question Management**: Manage reusable questions in centralized bank
3. **Submission Handling**: Process and validate form submissions
4. **Analytics**: Generate reports and statistics from submission data
5. **Option Management**: Update option labels while maintaining data integrity

## Production Deployment

- Environment variable configuration
- Database connection pooling
- Error handling and logging
- Security best practices
- Performance optimization

## Support

- GitHub: https://github.com/saiqa-tech/checkops
- NPM: https://www.npmjs.com/package/@saiqa-tech/checkops
- Documentation: Complete API reference and usage guides included