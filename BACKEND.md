# CheckOps Form Builder Backend API

This document describes the backend implementation for the CheckOps Form Builder Submission SDK Phase 2, which provides a complete server-side solution with database integration, authentication, rate limiting, and comprehensive API endpoints.

## Features

### ✅ Phase 2 Implementation (100% Complete)

1. **Server-side Database Layer**
   - PostgreSQL 13+ with JSONB support
   - Optimized schemas and indexes
   - Migration system
   - Connection pooling

2. **Counter-based ID Generation**
   - Atomic counter operations
   - Sequential ID generation
   - Collision handling
   - Distributed-safe implementation

3. **Complete Backend APIs**
   - Forms management (CRUD)
   - Submissions handling
   - API key management
   - Audit logging
   - Statistics and analytics

4. **Data Integrity Checks**
   - Database constraints
   - Transaction management
   - Audit trail
   - Data validation

5. **Security Layer**
   - API key authentication
   - Permission-based access control
   - Rate limiting
   - Input validation
   - CORS configuration
   - Security headers

6. **Comprehensive Tests**
   - Unit tests
   - Integration tests
   - API endpoint testing
   - Error handling tests

7. **Documentation**
   - API documentation
   - Setup guides
   - Usage examples

## Architecture

### Database Schema

The backend uses PostgreSQL 13+ with the following main tables:

- **`counters`** - For generating sequential IDs
- **`forms`** - Form definitions with JSONB schemas
- **`form_versions`** - Version history for forms
- **`submissions`** - Form submission data
- **`api_keys`** - Authentication and authorization
- **`audit_logs`** - Comprehensive audit trail

### API Structure

```
/api/v1/
├── forms/
│   ├── GET    /                 # List forms
│   ├── POST   /                 # Create form
│   ├── GET    /search           # Search forms
│   ├── GET    /:id              # Get form
│   ├── PUT    /:id              # Update form
│   ├── PUT    /:id/schema       # Update form schema
│   ├── DELETE /:id              # Delete form
│   ├── GET    /:id/versions     # Get form versions
│   └── GET    /:id/versions/:version # Get specific version
├── submissions/
│   ├── POST   /forms/:id/submissions # Create submission
│   ├── GET    /                 # List submissions
│   ├── GET    /search           # Search submissions
│   ├── GET    /stats            # Get statistics
│   ├── GET    /:id              # Get submission
│   ├── GET    /by-id/:submissionId # Get by submission ID
│   ├── PUT    /:id/status       # Update status
│   ├── DELETE /:id              # Delete submission
│   └── GET    /forms/:id/submissions/recent # Get recent
└── api-keys/
    ├── GET    /                 # List API keys
    ├── POST   /                 # Create API key
    ├── GET    /:id              # Get API key
    ├── PUT    /:id              # Update API key
    ├── POST   /:id/revoke       # Revoke API key
    ├── POST   /:id/regenerate   # Regenerate API key
    └── DELETE /:id              # Delete API key
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- npm or pnpm

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=checkops
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# Rate Limiting (optional, defaults will be used)
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start the server in development
npm run dev

# Start the server in production
npm start
```

## Usage

### Authentication

All API endpoints (except health check) require authentication using Bearer tokens:

```bash
curl -H "Authorization: Bearer your_api_key" \
     https://api.example.com/api/v1/forms
```

### Creating Forms

```bash
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Contact Form",
    "description": "A simple contact form",
    "schema": {
      "id": "contact-form",
      "fields": [
        {
          "name": "fullName",
          "type": "text",
          "required": true,
          "minLength": 2
        },
        {
          "name": "email",
          "type": "email",
          "required": true
        }
      ]
    }
  }' \
  https://api.example.com/api/v1/forms
```

### Creating Submissions

```bash
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  }' \
  https://api.example.com/api/v1/forms/form_123/submissions
```

### Managing API Keys

```bash
# Create a new API key
curl -X POST \
  -H "Authorization: Bearer your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "description": "Key for production usage",
    "permissions": ["forms:read", "submissions:create"],
    "rateLimitPerHour": 1000
  }' \
  https://api.example.com/api/v1/api-keys
```

## Security Features

### API Key Authentication

- Secure Bearer token authentication
- Hashed key storage using bcrypt
- Configurable permissions system
- Rate limiting per API key

### Rate Limiting

- Global rate limiting
- Per-endpoint rate limiting
- Customizable limits per API key
- Graceful degradation

### Data Validation

- Comprehensive input validation
- Schema validation for forms
- Type checking and sanitization
- Custom validation rules

### Audit Logging

- Complete audit trail
- Track all CRUD operations
- User activity logging
- Configurable retention policies

## API Key Permissions

The system uses a granular permission system:

- `forms:*` - Full form management
- `forms:read` - Read forms
- `forms:create` - Create forms
- `forms:update` - Update forms
- `forms:delete` - Delete forms
- `submissions:*` - Full submission management
- `submissions:read` - Read submissions
- `submissions:create` - Create submissions
- `submissions:update` - Update submissions
- `submissions:delete` - Delete submissions
- `api-keys:*` - Full API key management
- `api-keys:read` - Read API keys
- `api-keys:create` - Create API keys
- `api-keys:update` - Update API keys
- `api-keys:delete` - Delete API keys

## Testing

### Running Tests

```bash
# Run unit tests
npm test

# Run integration tests (requires test database)
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Test Database Setup

For integration tests, set up a test database:

```bash
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=checkops_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=test_password

npm run test:integration
```

## Monitoring and Logging

### Logging

The application uses Winston for structured logging:

- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Console output in development

### Health Check

```bash
curl https://api.example.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-11-07T12:00:00.000Z",
  "uptime": 3600.123,
  "version": "2.0.0",
  "environment": "production"
}
```

### API Documentation

Interactive API documentation is available at:
```
https://api.example.com/api/v1/docs
```

## Performance Considerations

### Database Optimization

- Optimized indexes for common queries
- JSONB indexing for form schemas and submission data
- Connection pooling for high concurrency
- Query optimization for large datasets

### Caching

- In-memory rate limiting
- Database connection pooling
- Efficient query patterns

### Scalability

- Stateless API design
- Horizontal scaling support
- Load balancer ready
- Database read replicas support

## Deployment

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Configurations

- Development: Detailed logging, relaxed CORS
- Staging: Production-like settings
- Production: Optimized logging, security headers

## Migration Guide

### From Phase 1 (Client-side only)

1. Set up PostgreSQL database
2. Run migrations: `npm run migrate`
3. Create API keys for your applications
4. Update client SDK base URL to point to your backend
5. Test integration with existing forms

### Data Migration

The backend is designed to work with existing form schemas. Simply:

1. Import your existing form schemas via the API
2. Update your client applications to use the new endpoints
3. Migrate any existing submission data if needed

## Support

For issues, questions, or contributions:

- GitHub Issues: [Repository Issues]
- Documentation: [API Docs](https://docs.checkops.dev/form-builder)
- Examples: [Examples Directory]

## License

This implementation is licensed under the MIT License - see the LICENSE file for details.