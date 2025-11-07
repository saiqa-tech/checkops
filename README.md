# CheckOps Form Builder SDK

A comprehensive, reusable NPM library for building and managing forms, submissions, and validation in any Node.js application.

## 🚀 Installation

```bash
npm install @saiqa-tech/checkops
```

**Peer Dependencies**: This package requires PostgreSQL to be installed in your project:
```bash
npm install pg
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { 
  FormService, 
  SubmissionService, 
  SecurityService,
  ValidationService,
  IdGenerator,
  createPool 
} from '@saiqa-tech/checkops';

// Initialize database connection
const pool = createPool({
  host: 'localhost',
  port: 5432,
  database: 'your_database',
  user: 'your_username',
  password: 'your_password'
});

// Initialize services
const formService = new FormService(pool);
const submissionService = new SubmissionService(pool);
const securityService = new SecurityService(pool, 'your-jwt-secret');
const validationService = new ValidationService(pool);
const idGenerator = new IdGenerator(pool);
```

### Create a Form

```typescript
const form = await formService.createForm({
  title: 'Contact Form',
  description: 'A simple contact form',
  schema: {
    id: 'contact-form',
    fields: [
      {
        name: 'name',
        label: 'Full Name',
        type: 'text',
        required: true
      },
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        required: true
      },
      {
        name: 'message',
        label: 'Message',
        type: 'textarea',
        required: true
      }
    ]
  },
  createdBy: 'user-123'
});
```

### Handle Submissions

```typescript
const submission = await submissionService.createSubmission({
  formId: 'contact-form',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello from the CheckOps SDK!'
  },
  submittedBy: 'user-123'
});

console.log('Submission created:', submission.id);
```

### API Key Security

```typescript
// Create an API key
const { apiKey, apiKeyData } = await securityService.createApiKey({
  name: 'Production API Key',
  permissions: ['forms:read', 'submissions:create', 'submissions:read'],
  rateLimitPerHour: 1000,
  createdBy: 'admin-user'
});

// Authenticate requests
const authResult = await securityService.authenticate({
  apiKey: 'your-api-key-here'
});

if (authResult.isValid) {
  // Use authResult.apiKey for authorized operations
  const hasPermission = await securityService.checkPermission(
    authResult.apiKey,
    'forms:delete'
  );
}
```

### Data Validation

```typescript
// Create validation rules
await validationService.createValidationRule({
  fieldId: 'email',
  type: 'email',
  parameters: {},
  errorMessage: 'Please enter a valid email address'
});

// Validate submission data
const validationResult = await validationService.validateSubmission(
  { email: 'invalid-email' },
  'contact-form'
);

if (!validationResult.isValid) {
  console.error('Validation errors:', validationResult.errors);
} else {
  console.log('Validated data:', validationResult.validatedData);
}
```

### ID Generation

```typescript
// Generate sequential IDs
const formId = await idGenerator.getNextId('forms'); // e.g., forms_123
const submissionId = await idGenerator.getNextId('submissions'); // e.g., submissions_456

// Reset counter
await idGenerator.resetCounter('forms', 1);
```

## 🔧 Advanced Features

### Custom Validation

```typescript
// Create custom validation rules
await validationService.createValidationRule({
  fieldId: 'phone',
  type: 'custom',
  parameters: { 
    pattern: '^\\+?[0-9]{7,15}$',
    message: 'Please enter a valid phone number'
  },
  errorMessage: 'Invalid phone number format'
});
```

### Submission History

```typescript
import { SubmissionHistoryService } from '@saiqa-tech/checkops';

const historyService = new SubmissionHistoryService(pool);

// Create history entry
await historyService.createHistoryEntry({
  submissionId: 'submission-123',
  action: 'updated',
  oldData: { status: 'pending' },
  newData: { status: 'processed' },
  reason: 'Manual review completed',
  performedBy: 'admin-user'
});

// Get submission history
const history = await historyService.getHistoryBySubmissionId('submission-123');
```

### Search Functionality

```typescript
// Full-text search forms
const searchResults = await formService.searchForms('contact', 20);

// Search submissions
const submissionResults = await submissionService.searchSubmissions('john@example.com', 10);
```

## 🔒 Security Features

### API Key Management

- **Secure key generation** with bcrypt hashing
- **Granular permissions** system
- **Rate limiting** per API key
- **JWT token** generation and verification
- **Key expiration** support

### Built-in Permissions

- `forms:*` - Full form management
- `forms:read` - Read forms only
- `forms:create` - Create new forms
- `forms:update` - Update existing forms
- `forms:delete` - Delete forms
- `submissions:*` - Full submission management
- `submissions:read` - Read submissions only
- `submissions:create` - Create new submissions
- `submissions:update` - Update submissions
- `submissions:delete` - Delete submissions
- `api_keys:*` - Full API key management

## 📊 Analytics & Statistics

```typescript
// Get submission statistics
const stats = await submissionService.getSubmissionStats('form-123');
console.log({
  total: stats.total,
  pending: stats.pending,
  processed: stats.processed,
  failed: stats.failed
});

// Get all forms with pagination
const forms = await formService.getAllForms(20, 0); // 20 forms, offset 0
```

## 🗂️ Database Requirements

This package requires PostgreSQL 13+ with the following tables (set up by you):

### Required Tables

```sql
-- Forms table
CREATE TABLE forms (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Submissions table
CREATE TABLE submissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_by VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE api_keys (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Validation Rules table
CREATE TABLE validation_rules (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check
```

## 📚 API Reference

### Core Services

- **FormService**: Complete CRUD operations for forms
- **SubmissionService**: Handle form submissions with status tracking
- **SecurityService**: API key authentication and authorization
- **ValidationService**: Create and manage validation rules
- **IdGenerator**: Generate sequential, collision-free IDs
- **SubmissionHistoryService**: Track all submission changes

### Database Utilities

- **createPool(config)**: Create PostgreSQL connection pool
- **defaultDatabaseConfig**: Default configuration object

### Types

All services are fully typed with TypeScript. Type definitions are included in the package.

## 🚀 Production Deployment

1. **Install dependencies**: `npm install @saiqa-tech/checkops pg`
2. **Set up database**: Create required tables (see Database Requirements)
3. **Configure connection**: Use environment variables for database config
4. **Handle errors**: Implement proper error handling and logging
5. **Monitor**: Set up monitoring for API key usage and performance

## 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/@saiqa-tech/checkops
- **GitHub Repository**: https://github.com/saiqa-tech/checkops
- **Documentation**: See [NPM_SETUP.md](./NPM_SETUP.md) for detailed usage
- **Examples**: See [examples/](./examples/) directory for code samples

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.