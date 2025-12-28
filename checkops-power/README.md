# CheckOps Kiro Power

A comprehensive Kiro Power for integrating CheckOps - a production-ready Node.js package for creating dynamic forms with centralized question reusability and structured data submission capabilities.

**✨ Now includes a powerful wrapper library for seamless Node.js integration!**

## Features

- **Automated Setup**: Installs CheckOps and dependencies automatically
- **Database Configuration**: Guides through PostgreSQL setup and migration
- **Code Generation**: Creates initialization and sample code
- **Wrapper Library**: Enhanced CheckOps integration with utilities and middleware
- **Express.js Integration**: Ready-to-use Express middleware and routes
- **MCP Integration**: Provides Model Context Protocol server for CheckOps operations
- **Best Practices**: Includes comprehensive steering guides for production deployment
- **Project Agnostic**: Works with any Node.js project

## Wrapper Library Highlights

The included wrapper library (`lib/`) provides:

### 🎯 CheckOpsWrapper Class
- **Auto-retry logic** with exponential backoff
- **Event-driven architecture** for monitoring operations
- **Built-in caching** with TTL support
- **Metrics collection** and health checks
- **Queue-based processing** for submissions
- **Validation helpers** and error handling

### 🚀 Express.js Middleware
- **Ready-to-use routes** for forms, submissions, and analytics
- **Security middleware** with rate limiting and validation
- **Error handling** with structured responses
- **Health checks** and metrics endpoints
- **CSV export** functionality

### 🛠️ Utility Classes
- **FormBuilder**: Fluent API for creating forms
- **FormTemplates**: Pre-built form templates (contact, feedback, registration, etc.)
- **ValidationHelpers**: Input validation and data sanitization
- **DataHelpers**: CSV export, analytics, and data transformation

## Activation Keywords

This power activates when you mention any of these keywords in Kiro:
- `checkops`
- `ops checks`
- `database monitoring`
- `checkops init`
- `form builder`
- `dynamic forms`
- `submission handling`

## Quick Start

1. **Install the Power**: Copy this directory to your Kiro Powers location
2. **Activate in Project**: Mention "checkops" in any Node.js project
3. **Follow Setup**: The power will guide you through:
   - Installing `@saiqa-tech/checkops` and `pg` packages
   - Configuring database connection
   - Running database migrations
   - Creating sample code

## What Gets Created

When activated, this power creates:

- `.env` - Database configuration file
- `checkops-init.js` - Initialization and connection test
- `checkops-examples.js` - Sample form creation and usage
- Updated `.gitignore` - Excludes sensitive environment files

## Database Requirements

- PostgreSQL 18 or higher
- JSONB support (PostgreSQL 9.4+)
- Database credentials (host, port, database, user, password)

## MCP Server

The power includes an MCP server (`checkops-mcp-server.js`) that provides tools for:

- Testing database connections
- Creating and managing forms
- Handling submissions
- Getting analytics and statistics
- Managing reusable questions

### Available MCP Tools

- `checkops_test_connection` - Test database connectivity
- `checkops_create_form` - Create new forms with questions
- `checkops_get_forms` - Retrieve forms (all or by ID)
- `checkops_create_submission` - Submit form responses
- `checkops_get_submissions` - Get form submissions
- `checkops_get_stats` - Get submission statistics
- `checkops_create_question` - Create reusable questions
- `checkops_get_questions` - Retrieve questions

## Steering Guides

The power includes comprehensive guides in the `steering/` directory:

- **getting-started.md** - Basic setup and first steps
- **form-creation.md** - Complete guide to creating dynamic forms
- **question-management.md** - Managing reusable questions and options
- **error-handling.md** - Production-ready error handling patterns
- **production-deployment.md** - Deployment, security, and monitoring

## Usage Examples

### Using the Wrapper Library

```javascript
import { CheckOpsWrapper, FormBuilder, FormTemplates } from 'checkops-power';

// Initialize with enhanced features
const checkops = new CheckOpsWrapper({
  enableLogging: true,
  enableMetrics: true,
  retryAttempts: 3,
  autoReconnect: true,
});

// Enable caching
checkops.enableCache();

// Listen to events
checkops.on('formCreated', (form) => {
  console.log(`Form created: ${form.title}`);
});

await checkops.initialize();

// Use FormBuilder for fluent form creation
const form = await checkops.createForm(
  new FormBuilder()
    .title('Contact Form')
    .description('Get in touch')
    .textQuestion('Name', true)
    .emailQuestion('Email', true)
    .ratingQuestion('Satisfaction', [1, 2, 3, 4, 5])
    .build()
);

// Or use pre-built templates
const feedbackForm = await checkops.createForm(
  FormTemplates.feedbackForm()
);

// Create submissions with validation
await checkops.createSubmission({
  formId: form.id,
  submissionData: {
    'Name': 'John Doe',
    'Email': 'john@example.com',
    'Satisfaction': 5,
  },
});

// Get analytics with caching
const stats = await checkops.getStats(form.id, true);
```

### Express.js Integration

```javascript
import express from 'express';
import { createCheckOpsRouter } from 'checkops-power';

const app = express();
app.use(express.json());

// Add CheckOps routes with built-in middleware
const checkopsRouter = createCheckOpsRouter({
  enableLogging: true,
  enableMetrics: true,
});

app.use('/api/checkops', checkopsRouter);

// Available endpoints:
// POST /api/checkops/forms - Create forms
// GET /api/checkops/forms/:id - Get form
// POST /api/checkops/forms/:formId/submissions - Submit responses
// GET /api/checkops/forms/:formId/submissions - Get submissions
// GET /api/checkops/forms/:formId/stats - Get analytics
// GET /api/checkops/health - Health check
// GET /api/checkops/metrics - Performance metrics

app.listen(3000);
```

### Basic CheckOps Usage

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await checkops.initialize();

const form = await checkops.createForm({
  title: 'Customer Feedback',
  questions: [
    {
      questionText: 'Your Name',
      questionType: 'text',
      required: true,
    },
    {
      questionText: 'Rating',
      questionType: 'rating',
      options: [1, 2, 3, 4, 5],
      required: true,
    },
  ],
});
```

### Handling Submissions

```javascript
const submission = await checkops.createSubmission({
  formId: form.id,
  submissionData: {
    'Your Name': 'John Doe',
    'Rating': 5,
  },
});
```

### Getting Analytics

```javascript
const stats = await checkops.getSubmissionStats(form.id);
console.log('Total submissions:', stats.totalSubmissions);
```

## Configuration

### Environment Variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
```

### MCP Configuration

Add to your `mcp.json`:

```json
{
  "mcpServers": {
    "checkops-tools": {
      "command": "node",
      "args": ["./checkops-mcp-server.js"],
      "env": {
        "DB_HOST": "${DB_HOST}",
        "DB_PORT": "${DB_PORT}",
        "DB_NAME": "${DB_NAME}",
        "DB_USER": "${DB_USER}",
        "DB_PASSWORD": "${DB_PASSWORD}"
      }
    }
  }
}
```

## Supported Question Types

- **Text Input**: text, textarea, email, phone, number
- **Date/Time**: date, time, datetime
- **Selection**: select, multiselect, radio, checkbox, boolean
- **Special**: rating, file upload

## Key Features

### Option Key-Value System
Stable option keys prevent data corruption when labels change:

```javascript
{
  questionText: 'Department',
  questionType: 'select',
  options: [
    { key: 'dept_eng', label: 'Engineering' },
    { key: 'dept_sales', label: 'Sales' }
  ]
}

// Update labels safely
await checkops.updateOptionLabel(questionId, 'dept_eng', 'Engineering & Tech');
```

### Question Reusability
Create questions once, use in multiple forms:

```javascript
const nameQuestion = await checkops.createQuestion({
  questionText: 'Full Name',
  questionType: 'text',
  metadata: { category: 'personal-info' }
});

// Use in multiple forms
const form1 = await checkops.createForm({
  title: 'Registration',
  questions: [{ questionId: nameQuestion.id, required: true }]
});
```

## Production Ready

- **Security**: Input sanitization, parameterized queries, SSL support
- **Performance**: Connection pooling, caching strategies, optimized queries
- **Monitoring**: Structured logging, health checks, metrics
- **Scalability**: Horizontal scaling, load balancing, database optimization

## Support

- **GitHub**: https://github.com/saiqa-tech/checkops
- **NPM**: https://www.npmjs.com/package/@saiqa-tech/checkops
- **Documentation**: Complete API reference and guides included

## License

Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions welcome! Please see the [Contributing Guide](CONTRIBUTING.md) for details.

---

Built with ❤️ by [Saiqa Tech](https://github.com/saiqa-tech) for the developer community.