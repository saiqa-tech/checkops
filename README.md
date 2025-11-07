# CheckOps Form Builder Submission SDK

A complete SDK for validating and submitting CheckOps Form Builder submissions with both client-side validation and full backend server implementation. It provides pluggable validation, normalized payload creation, and a comprehensive HTTP wrapper for creating submissions from browser or server runtimes.

## 🚀 Phase 2 Complete - Full Backend Implementation

This SDK now includes a complete backend implementation with:

- ✅ **Server-side Database Layer** - PostgreSQL 13+ with JSONB support
- ✅ **Counter-based ID Generation** - Atomic, sequential ID generation
- ✅ **Complete Backend APIs** - Forms, submissions, and API key management
- ✅ **Data Integrity Checks** - Database constraints, transactions, and audit logging
- ✅ **Security Layer** - API key authentication, rate limiting, and permissions
- ✅ **Comprehensive Tests** - Unit and integration test coverage
- ✅ **Documentation** - Complete API documentation and setup guides

## 📦 Installation

```bash
npm install @checkops/form-builder-submission-sdk
# or
pnpm add @checkops/form-builder-submission-sdk
```

## 🎯 Quick Start

### Client-side SDK Usage

```ts
import { FormBuilderSubmissionSDK, type FormSchema } from '@checkops/form-builder-submission-sdk';

const schema: FormSchema = {
  id: 'contact-form',
  version: '1.0.0',
  fields: [
    { name: 'fullName', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'subscribe', type: 'boolean', defaultValue: false }
  ]
};

const sdk = new FormBuilderSubmissionSDK({
  baseUrl: 'https://api.checkops.dev',
  apiKey: process.env.CHECKOPS_API_KEY
});

const result = await sdk.submit(schema, {
  fullName: 'Jane Doe',
  email: 'jane@example.com'
});

console.log(result.response?.status); // 201
console.log(result.payload); // normalized payload that was sent
```

### Backend Server Setup

```bash
# Clone the repository
git clone https://github.com/saiqa-tech/checkops.git
cd checkops

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database configuration

# Run database migrations
npm run migrate

# Start the server
npm run dev
```

## 📚 Documentation

### Client SDK Documentation
- [API Reference](#api-reference)
- [Validation Rules](#validation-rules)
- [Error Handling](#error-handling)

### Backend Documentation
- [Backend Setup Guide](./BACKEND.md)
- [API Endpoints](./BACKEND.md#api-structure)
- [Security Features](./BACKEND.md#security-features)
- [Database Schema](./BACKEND.md#database-schema)

## 🔧 Features

### Client-side SDK
- **Form Validation**: Comprehensive client-side validation with custom rules
- **Type Safety**: Full TypeScript support with type definitions
- **Flexible Submission**: Support for dry runs and custom transformations
- **Error Handling**: Detailed error information and warnings
- **Browser & Node**: Works in both browser and server environments

### Backend Server
- **Database Integration**: PostgreSQL with optimized JSONB storage
- **Authentication**: Secure API key-based authentication with permissions
- **Rate Limiting**: Configurable rate limiting per API key and endpoint
- **Audit Logging**: Complete audit trail for all operations
- **API Management**: Full CRUD operations for forms and submissions
- **Security**: CORS, security headers, input validation, and sanitization

## 🎨 Validation Rules

The SDK supports comprehensive field validation:

```ts
const schema: FormSchema = {
  id: 'advanced-form',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s]+$/
    },
    {
      name: 'age',
      type: 'integer',
      required: true,
      min: 18,
      max: 120
    },
    {
      name: 'email',
      type: 'email',
      required: true
    },
    {
      name: 'interests',
      type: 'multi-select',
      options: [
        { value: 'tech', label: 'Technology' },
        { value: 'sports', label: 'Sports' },
        { value: 'music', label: 'Music' }
      ]
    },
    {
      name: 'profile',
      type: 'json',
      validator: (value, field, payload) => {
        if (!value.social) return 'Social media links required';
      }
    }
  ]
};
```

## 🔐 Security Features

### API Key Authentication
```ts
// Create API key with specific permissions
const apiKeyResponse = await fetch('/api/v1/api-keys', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer admin_key' },
  body: JSON.stringify({
    name: 'Production API Key',
    permissions: ['forms:read', 'submissions:create'],
    rateLimitPerHour: 1000
  })
});
```

### Rate Limiting
- Configurable per API key
- Endpoint-specific limits
- Graceful degradation
- Detailed headers

### Data Integrity
- Database constraints
- Transaction management
- Audit logging
- Input validation

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests (requires test database)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build
```

## 📊 API Reference

### Client SDK

#### FormBuilderSubmissionSDK
- `constructor(config)` - Initialize the SDK
- `validate(schema, data)` - Validate form data
- `buildSubmission(schema, data, options)` - Build submission payload
- `submit(schema, data, options)` - Submit form data
- `submitPayload(formId, payload, options)` - Submit pre-built payload

#### Utilities
- `validateFormData` - Standalone validation function
- `httpRequest` - HTTP request utility

#### Core Types
- `FormSchema` - Form definition
- `SubmissionPayload` - Submission data structure
- `SubmissionOptions` - Submission configuration
- `SubmitResult` - Submission response
- `ValidationResult` - Validation results

### Backend API

#### Forms API
- `GET /api/v1/forms` - List forms
- `POST /api/v1/forms` - Create form
- `GET /api/v1/forms/:id` - Get form
- `PUT /api/v1/forms/:id` - Update form
- `DELETE /api/v1/forms/:id` - Delete form

#### Submissions API
- `POST /api/v1/forms/:id/submissions` - Create submission
- `GET /api/v1/submissions` - List submissions
- `GET /api/v1/submissions/:id` - Get submission
- `PUT /api/v1/submissions/:id/status` - Update status

#### API Keys API
- `GET /api/v1/api-keys` - List API keys
- `POST /api/v1/api-keys` - Create API key
- `PUT /api/v1/api-keys/:id` - Update API key
- `DELETE /api/v1/api-keys/:id` - Delete API key

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client SDK    │    │   Backend API   │    │   PostgreSQL    │
│                 │    │                 │    │     Database    │
│ • Validation    │◄──►│ • Auth & Auth   │◄──►│                 │
│ • HTTP Client   │    │ • Rate Limiting │    │ • JSONB Storage │
│ • Type Safety   │    │ • Audit Logging │    │ • Indexes       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=checkops
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Install dependencies
npm install

# Set up test database
createdb checkops_test

# Run migrations
npm run migrate

# Start development server
npm run dev

# Run tests
npm test
```

## 📄 License

[MIT](./LICENSE) - see the LICENSE file for details.

## 🔗 Links

- [Backend Documentation](./BACKEND.md)
- [API Documentation](./BACKEND.md#api-structure)
- [Database Schema](./BACKEND.md#database-schema)
- [Security Guide](./BACKEND.md#security-features)
- [Examples](./examples/)
- [GitHub Repository](https://github.com/saiqa-tech/checkops)
