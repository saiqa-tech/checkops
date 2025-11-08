# CheckOps Architecture

This document describes the system architecture and design decisions for CheckOps.

## Overview

CheckOps is a **layered architecture** npm package designed for building dynamic forms with centralized question management. It follows separation of concerns principles with clear boundaries between layers.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│             Application Layer                    │
│         (Your Node.js Application)              │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              CheckOps SDK                        │
│          (Public API Interface)                  │
│              src/index.js                        │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│             Service Layer                        │
│   (Business Logic & Validation)                  │
│   - FormService                                  │
│   - QuestionService                              │
│   - SubmissionService                            │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              Model Layer                         │
│        (Data Access & ORM)                       │
│   - Form Model                                   │
│   - Question Model                               │
│   - Submission Model                             │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│          Database Layer                          │
│       (PostgreSQL 18 + JSONB)                    │
└─────────────────────────────────────────────────┘
```

## Component Details

### 1. SDK Layer (src/index.js)

**Responsibility**: Public API interface

**Components**:
- `CheckOps` class - Main entry point
- Connection management
- Service initialization
- Error propagation

**Key Features**:
- Simple, intuitive API
- Automatic initialization checking
- Graceful shutdown handling
- Error wrapping

**Example**:
```javascript
const checkops = new CheckOps(config);
await checkops.initialize();
const form = await checkops.createForm(...);
```

### 2. Service Layer

**Responsibility**: Business logic and validation

#### FormService (src/services/FormService.js)

- Form CRUD operations
- Question enrichment from question bank
- Input sanitization
- Validation

#### QuestionService (src/services/QuestionService.js)

- Question bank management
- Question type validation
- Bulk operations
- Question lifecycle management

#### SubmissionService (src/services/SubmissionService.js)

- Submission creation and validation
- Form-submission relationship management
- Statistics generation
- Answer validation against form rules

**Key Features**:
- Input sanitization before database operations
- Comprehensive validation
- Transaction support
- Error handling with custom error types

### 3. Model Layer

**Responsibility**: Data access and database operations

#### Form Model (src/models/Form.js)

```javascript
class Form {
  static async create(data)
  static async findById(id)
  static async findAll(filters)
  static async update(id, updates)
  static async delete(id)
  static async count(filters)
}
```

#### Question Model (src/models/Question.js)

```javascript
class Question {
  static async create(data)
  static async findById(id)
  static async findByIds(ids)
  static async findAll(filters)
  static async update(id, updates)
  static async delete(id)
  static async count(filters)
}
```

#### Submission Model (src/models/Submission.js)

```javascript
class Submission {
  static async create(data)
  static async findById(id)
  static async findByFormId(formId)
  static async findAll(filters)
  static async update(id, updates)
  static async delete(id)
  static async count(filters)
}
```

**Key Features**:
- Parameterized queries (SQL injection protection)
- Transaction support
- Automatic timestamp management
- Human-readable ID generation
- JSONB handling

### 4. Utility Layer

#### Database Configuration (src/config/database.js)

- Connection pool management
- Configuration handling
- Connection testing
- Graceful shutdown

#### ID Generator (src/utils/idGenerator.js)

- Human-readable ID generation
- Counter-based system
- Format: FORM-001, Q-001, SUB-001
- Thread-safe increments

#### Validation (src/utils/validation.js)

- Email validation
- Phone validation
- URL validation
- Question type validation
- Submission data validation
- Type checking functions

#### Sanitization (src/utils/sanitization.js)

- String sanitization
- HTML entity encoding
- JSONB sanitization
- XSS prevention
- SQL injection prevention

#### Error Classes (src/utils/errors.js)

- `CheckOpsError` - Base error
- `ValidationError` - Validation failures
- `NotFoundError` - Resource not found
- `DatabaseError` - Database issues
- `DuplicateError` - Duplicate entries
- `InvalidOperationError` - Invalid operations

## Data Flow

### Creating a Form

```
1. Application calls checkops.createForm()
   ↓
2. SDK validates initialization
   ↓
3. FormService receives request
   ↓
4. FormService validates input
   ↓
5. FormService sanitizes input
   ↓
6. FormService enriches questions from bank
   ↓
7. Form.create() called
   ↓
8. Database transaction begins
   ↓
9. Generate human-readable ID
   ↓
10. Insert form into database
   ↓
11. Transaction commits
   ↓
12. Return Form object
```

### Submitting a Form

```
1. Application calls checkops.createSubmission()
   ↓
2. SDK validates initialization
   ↓
3. SubmissionService receives request
   ↓
4. SubmissionService fetches form
   ↓
5. Validate form is active
   ↓
6. Validate submission data against form rules
   ↓
7. Sanitize submission data
   ↓
8. Submission.create() called
   ↓
9. Database transaction begins
   ↓
10. Verify form exists (foreign key)
   ↓
11. Generate human-readable ID
   ↓
12. Insert submission into database
   ↓
13. Transaction commits
   ↓
14. Return Submission object
```

## Design Patterns

### 1. Factory Pattern

Used for model creation with `fromRow()` methods:

```javascript
static fromRow(row) {
  if (!row) return null;
  return new Form({
    id: row.id,
    title: row.title,
    ...
  });
}
```

### 2. Repository Pattern

Models act as repositories for data access:

```javascript
await Form.findById(id);
await Form.findAll(filters);
```

### 3. Service Layer Pattern

Business logic separated from data access:

```javascript
class FormService {
  async createForm() {
    // Validation
    // Sanitization
    // Business logic
    // Call model
  }
}
```

### 4. Singleton Pattern

Database connection pool is a singleton:

```javascript
let pool = null;

export function initializeDatabase(config) {
  if (pool) throw new Error('Already initialized');
  pool = new Pool(config);
}
```

### 5. Strategy Pattern

Different validation strategies for question types:

```javascript
if (question.questionType === 'email') {
  validateEmail(answer);
} else if (question.questionType === 'number') {
  validateNumber(answer);
}
```

## Security Architecture

### Defense in Depth

Multiple layers of security:

1. **Input Layer**: Sanitization at service layer
2. **Database Layer**: Parameterized queries
3. **Application Layer**: Validation before processing
4. **Transport Layer**: HTTPS recommended

### SQL Injection Prevention

```javascript
// GOOD - Parameterized query
await pool.query('SELECT * FROM forms WHERE id = $1', [id]);

// BAD - String concatenation (never used)
// await pool.query(`SELECT * FROM forms WHERE id = '${id}'`);
```

### XSS Prevention

```javascript
// Sanitize all string inputs
const sanitized = sanitizeString(userInput);
// Escape HTML entities
const safe = sanitizeHtml(htmlContent);
```

### Error Handling

```javascript
// Never expose internal errors
catch (error) {
  throw new DatabaseError('Operation failed', error);
  // Original error logged internally, not exposed to user
}
```

## Performance Optimizations

### 1. Connection Pooling

```javascript
const pool = new Pool({
  max: 20,        // Maximum connections
  min: 2,         // Minimum connections
  idleTimeoutMillis: 30000,
});
```

### 2. JSONB Indexing

```sql
CREATE INDEX idx_forms_questions ON forms USING GIN (questions);
```

### 3. Prepared Statements

Parameterized queries are automatically prepared by PostgreSQL.

### 4. Transaction Batching

Related operations grouped in transactions:

```javascript
await client.query('BEGIN');
// Multiple operations
await client.query('COMMIT');
```

### 5. Pagination

```javascript
await Form.findAll({
  limit: 100,
  offset: 0,
});
```

## Scalability Considerations

### Horizontal Scaling

- **Stateless Design**: No session state in package
- **Connection Pooling**: Multiple app instances share pool
- **Read Replicas**: Can be configured for read-heavy loads

### Vertical Scaling

- **Connection Limits**: Configurable pool size
- **Query Optimization**: Indexed JSONB columns
- **Efficient Queries**: Limited result sets

### Data Partitioning

For very large deployments:

```sql
-- Partition submissions by date
CREATE TABLE submissions_2024_01 PARTITION OF submissions
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Testing Strategy

### Unit Tests

- Test individual functions
- Mock dependencies
- 80%+ coverage target

### Integration Tests

- Test with real database
- End-to-end workflows
- Transaction rollbacks

### Performance Tests

- Load testing
- Concurrency testing
- Query performance

## Deployment Architecture

### Development

```
Application → CheckOps → Local PostgreSQL
```

### Production

```
Application (Load Balanced)
    ↓
CheckOps Package
    ↓
Connection Pool (PgBouncer)
    ↓
PostgreSQL Primary
    ├─ Read Replica 1
    └─ Read Replica 2
```

## Configuration Management

### Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=checkops
DB_USER=postgres
DB_PASSWORD=secret
DB_POOL_MAX=20
DB_POOL_MIN=2
```

### Programmatic Configuration

```javascript
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  min: 2,
});
```

## Extension Points

### Custom Validation

```javascript
// Future: Plugin system for custom validators
checkops.registerValidator('customType', validatorFn);
```

### Custom Question Types

```javascript
// Future: Register custom question types
checkops.registerQuestionType('signature', {
  validate: (value) => {...},
  render: (question) => {...},
});
```

### Hooks

```javascript
// Future: Event hooks
checkops.on('submission:created', async (submission) => {
  // Send notification
});
```

## Monitoring and Observability

### Recommended Metrics

- Query execution time
- Connection pool utilization
- Error rates by type
- Submission volume
- Form access patterns

### Logging

```javascript
// Structured logging recommended
logger.info('Form created', {
  formId: form.id,
  questionCount: form.questions.length,
  userId: req.user.id,
});
```

## Future Enhancements

1. **Caching Layer**: Redis integration for form caching
2. **Event System**: Webhooks for form events
3. **Analytics**: Built-in analytics engine
4. **File Upload**: S3 integration for file questions
5. **Multi-tenancy**: Row-level security
6. **Audit Log**: Track all changes
7. **Export**: CSV/Excel/PDF export
8. **Templates**: Pre-built form templates
