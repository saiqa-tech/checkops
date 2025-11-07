# CheckOps Form Builder SDK - NPM Package Setup

## 🚀 Installation

```bash
npm install @saiqa-tech/checkops
```

## 📦 Peer Dependencies

This package requires PostgreSQL to be installed in your project:

```bash
npm install pg
```

## 🔧 Quick Start

### 1. Initialize Database Connection

```typescript
import { createPool, defaultDatabaseConfig } from '@saiqa-tech/checkops';

// Initialize database connection
const pool = createPool({
  host: 'localhost',
  port: 5432,
  database: 'your_database',
  user: 'your_username',
  password: 'your_password'
});
```

### 2. Form Management

```typescript
import { FormService, Form } from '@saiqa-tech/checkops';

const formService = new FormService(pool);

// Create a form
const createRequest = {
  title: 'Contact Form',
  description: 'A simple contact form',
  schema: {
    id: 'contact-form',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'message', type: 'textarea', required: true }
    ]
  },
  createdBy: 'user-123'
};

const form = await formService.createForm(createRequest);
```

### 3. Submission Handling

```typescript
import { SubmissionService, Submission } from '@saiqa-tech/checkops';

const submissionService = new SubmissionService(pool);

// Create a submission
const createRequest = {
  formId: 'form-123',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello, this is a test submission'
  },
  submittedBy: 'user-123'
};

const submission = await submissionService.createSubmission(createRequest);
```

### 4. Security & Authentication

```typescript
import { SecurityService, ApiKey } from '@saiqa-tech/checkops';

const securityService = new SecurityService(pool, 'your-jwt-secret');

// Create API key
const createKeyRequest = {
  name: 'Production API Key',
  permissions: ['forms:read', 'submissions:create'],
  rateLimitPerHour: 1000,
  createdBy: 'admin-123'
};

const { apiKey, apiKeyData } = await securityService.createApiKey(createKeyRequest);

// Authenticate requests
const authResult = await securityService.authenticate({
  apiKey: 'your-api-key-here'
});

if (authResult.isValid) {
  // Use authResult.apiKey for authorized operations
}

// Check permissions
const permissionCheck = await securityService.checkPermission(
  authResult.apiKey!,
  'forms:delete'
);

if (!permissionCheck.hasPermission) {
  throw new Error(permissionCheck.errorMessage);
}
```

### 5. Validation Service

```typescript
import { ValidationService } from '@saiqa-tech/checkops';

const validationService = new ValidationService(pool);

// Create validation rules
const ruleRequest = {
  fieldId: 'email',
  type: 'email',
  parameters: {},
  errorMessage: 'Please enter a valid email address'
};

const validationRule = await validationService.createValidationRule(ruleRequest);

// Validate submission data
const validationResult = await validationService.validateSubmission(
  { email: 'invalid-email' },
  'form-123'
);

if (!validationResult.isValid) {
  console.error('Validation errors:', validationResult.errors);
}
```

### 6. ID Generation

```typescript
import { IdGenerator } from '@saiqa-tech/checkops';

const idGenerator = new IdGenerator(pool);

// Generate sequential IDs
const formId = await idGenerator.getNextId('forms'); // e.g., forms_123
const submissionId = await idGenerator.getNextId('submissions'); // e.g., submissions_456

// Get current value
const currentValue = await idGenerator.getCurrentValue('forms');

// Reset counter
await idGenerator.resetCounter('forms', 1);
```

## 🗂️ Database Setup

This package doesn't include database migrations. You need to set up the required tables manually:

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

## 🔒 Security Best Practices

### API Key Management

1. **Store API keys securely** - Never commit API keys to version control
2. **Use environment variables** - Load secrets from environment variables
3. **Rotate keys regularly** - Use the expiration feature
4. **Principle of least privilege** - Grant only necessary permissions
5. **Rate limiting** - Configure appropriate rate limits per API key

### Database Security

1. **Use connection pooling** - The library handles this automatically
2. **Parameterized queries** - All database queries use parameterization
3. **Validate inputs** - Use the built-in validation services
4. **Handle errors gracefully** - Use proper error handling patterns

## 🧪 Testing

Run the test suite to ensure everything works:

```bash
npm test
```

## 📚 API Reference

### FormService

- `createForm(request)` - Create a new form
- `getFormById(id)` - Get form by ID
- `getAllForms(limit, offset)` - Get all forms with pagination
- `updateForm(id, updates)` - Update form metadata
- `deleteForm(id)` - Delete a form
- `searchForms(searchTerm, limit)` - Search forms

### SubmissionService

- `createSubmission(request)` - Create a new submission
- `getSubmissionById(id)` - Get submission by ID
- `getSubmissionsByFormId(formId, limit, offset)` - Get submissions for a form
- `getAllSubmissions(limit, offset)` - Get all submissions
- `updateSubmission(id, updates)` - Update submission status
- `deleteSubmission(id)` - Delete a submission
- `searchSubmissions(searchTerm, limit)` - Search submissions
- `getSubmissionStats(formId)` - Get submission statistics

### SecurityService

- `createApiKey(request)` - Create new API key
- `authenticate(request)` - Authenticate API key
- `getApiKeyById(id)` - Get API key by ID
- `getAllApiKeys(limit, offset)` - Get all API keys
- `updateApiKey(id, updates)` - Update API key
- `deactivateApiKey(id)` - Deactivate API key
- `deleteApiKey(id)` - Delete API key
- `checkPermission(apiKey, permission)` - Check permissions
- `generateJwtToken(payload, expiresIn)` - Generate JWT token
- `verifyJwtToken(token)` - Verify JWT token

### ValidationService

- `createValidationRule(request)` - Create validation rule
- `getValidationRuleById(id)` - Get validation rule
- `getValidationRulesByFieldId(fieldId)` - Get rules for a field
- `getAllValidationRules(limit, offset)` - Get all validation rules
- `deleteValidationRule(id)` - Delete validation rule
- `validateSubmission(data, formId)` - Validate submission data

### IdGenerator

- `getNextId(counterName)` - Get next sequential ID
- `getCurrentValue(counterName)` - Get current counter value
- `resetCounter(counterName, initialValue)` - Reset counter
- `createCounter(counterName, initialValue)` - Create new counter
- `getAllCounters()` - Get all counters

## 🔧 Configuration

### Database Configuration

```typescript
import { createPool, defaultDatabaseConfig } from '@saiqa-tech/checkops';

// Custom configuration
const pool = createPool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'myuser',
  password: 'mypassword',
  ssl: true,
  maxConnections: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Or use defaults
const defaultPool = createPool(defaultDatabaseConfig);
```

### Security Configuration

```typescript
import { SecurityService } from '@saiqa-tech/checkops';

const securityService = new SecurityService(pool, 'your-jwt-secret');
```

## 🚀 Production Deployment

1. **Install dependencies**: `npm install @saiqa-tech/checkops pg`
2. **Set up database**: Run the SQL schema setup
3. **Configure connection**: Use environment variables for configuration
4. **Handle errors**: Implement proper error handling
5. **Monitor**: Set up logging and monitoring
6. **Scale**: Use connection pooling and consider read replicas

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Support

For issues, questions, or contributions:
- GitHub: https://github.com/saiqa-tech/checkops
- NPM: https://www.npmjs.com/package/@saiqa-tech/checkops

---

**Note**: This is a pure library package. It does not include any server code, Express.js, or HTTP handlers. Use it as a dependency in your own Node.js application.