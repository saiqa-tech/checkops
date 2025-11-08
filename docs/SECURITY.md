# Security Best Practices

This document outlines security considerations and best practices when using CheckOps.

## Table of Contents

1. [Input Validation and Sanitization](#input-validation-and-sanitization)
2. [SQL Injection Prevention](#sql-injection-prevention)
3. [XSS Prevention](#xss-prevention)
4. [Authentication and Authorization](#authentication-and-authorization)
5. [Data Encryption](#data-encryption)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Database Security](#database-security)
9. [Network Security](#network-security)
10. [Compliance and Privacy](#compliance-and-privacy)

## Input Validation and Sanitization

### Built-in Sanitization

CheckOps automatically sanitizes all inputs:

```javascript
// All inputs are sanitized before storage
const form = await checkops.createForm({
  title: '<script>alert("xss")</script>',  // Will be sanitized
  questions: [...],
});
```

### Custom Validation

Always validate data at the application level:

```javascript
function validateUserInput(data) {
  // Whitelist allowed characters
  const nameRegex = /^[A-Za-z\s-]+$/;
  if (!nameRegex.test(data.name)) {
    throw new Error('Invalid name format');
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Invalid email format');
  }

  return true;
}

// Validate before submission
if (validateUserInput(formData)) {
  await checkops.createSubmission({
    formId: form.id,
    submissionData: formData,
  });
}
```

### Type Validation

```javascript
// Validate types before processing
function validateQuestionTypes(questions) {
  const validTypes = [
    'text', 'email', 'number', 'select', 'radio',
    'checkbox', 'textarea', 'date', 'time', 'datetime',
    'phone', 'boolean', 'file', 'rating', 'multiselect',
  ];

  questions.forEach((q) => {
    if (!validTypes.includes(q.questionType)) {
      throw new Error(`Invalid question type: ${q.questionType}`);
    }
  });
}
```

## SQL Injection Prevention

### Parameterized Queries

CheckOps **always** uses parameterized queries:

```javascript
// SAFE - Parameterized query (used internally)
await pool.query('SELECT * FROM forms WHERE id = $1', [formId]);

// NEVER DO THIS in your application
// await pool.query(`SELECT * FROM forms WHERE id = '${formId}'`);
```

### Safe Query Examples

```javascript
// Safe - Using CheckOps API
const form = await checkops.getForm(userProvidedId);

// Safe - Pagination
const submissions = await checkops.getSubmissionsByForm(formId, {
  limit: parseInt(req.query.limit) || 100,
  offset: parseInt(req.query.offset) || 0,
});
```

## XSS Prevention

### Output Encoding

Always encode output when displaying user-submitted data:

```javascript
import { sanitizeHtml } from '@saiqa-tech/checkops/utils/sanitization';

// In your template/view
function renderSubmission(submission) {
  const safeName = sanitizeHtml(submission.submissionData.name);
  return `<div class="submission">
    <p>Name: ${safeName}</p>
  </div>`;
}
```

### Content Security Policy

Implement CSP headers:

```javascript
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
  next();
});
```

### HTML Sanitization

```javascript
// For rich text fields, use a library like DOMPurify
import DOMPurify from 'isomorphic-dompurify';

function sanitizeRichText(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
}
```

## Authentication and Authorization

### User Authentication

CheckOps does not handle authentication. Implement your own:

```javascript
// Middleware example
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Protected route
app.post('/api/forms', requireAuth, async (req, res) => {
  const form = await checkops.createForm({
    ...req.body,
    metadata: {
      createdBy: req.session.userId,
    },
  });
  res.json({ form });
});
```

### Authorization

Implement role-based access control:

```javascript
// Check ownership before operations
async function checkFormOwnership(formId, userId) {
  const form = await checkops.getForm(formId);

  if (form.metadata.createdBy !== userId) {
    throw new Error('Unauthorized access');
  }

  return true;
}

// Use in routes
app.delete('/api/forms/:id', requireAuth, async (req, res) => {
  try {
    await checkFormOwnership(req.params.id, req.session.userId);
    await checkops.deleteForm(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
});
```

### API Keys

For API access, use secure API keys:

```javascript
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}

function isValidApiKey(key) {
  // Use constant-time comparison
  const crypto = require('crypto');
  const expected = Buffer.from(process.env.API_KEY);
  const provided = Buffer.from(key);

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}
```

## Data Encryption

### Encryption at Rest

Use PostgreSQL encryption:

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive data
INSERT INTO submissions (id, form_id, submission_data)
VALUES ('SUB-001', 'FORM-001',
  pgp_sym_encrypt('sensitive data', 'encryption_key')::jsonb
);
```

### Encryption in Transit

Always use HTTPS in production:

```javascript
// Enable SSL for database connection
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
  },
});
```

### Sensitive Data Handling

```javascript
// Never log sensitive data
logger.info('Submission created', {
  submissionId: submission.id,
  formId: submission.formId,
  // DON'T: submissionData: submission.submissionData
});

// Hash sensitive data before storage
import crypto from 'crypto';

function hashSensitiveData(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}
```

## Rate Limiting

### Express Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

// Submission rate limiter
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per window
  message: 'Too many submissions, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/forms/:id/submit', submissionLimiter, async (req, res) => {
  // Handle submission
});

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use('/api/', apiLimiter);
```

### Per-User Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: async (req) => {
    if (req.user.role === 'premium') return 1000;
    return 100;
  },
  keyGenerator: (req) => req.user.id,
});
```

## Error Handling

### Safe Error Messages

Never expose internal errors:

```javascript
import { errors } from '@saiqa-tech/checkops';

app.post('/api/forms', async (req, res) => {
  try {
    const form = await checkops.createForm(req.body);
    res.json({ form });
  } catch (error) {
    // Log full error internally
    logger.error('Form creation failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    // Return safe error to user
    if (error instanceof errors.ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details, // Safe to expose
      });
    } else {
      res.status(500).json({
        error: 'An error occurred',
        // DON'T expose: error.stack, error.message
      });
    }
  }
});
```

### Error Logging

```javascript
// Use structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log errors with context
try {
  await checkops.createSubmission(data);
} catch (error) {
  logger.error('Submission failed', {
    error: error.message,
    formId: data.formId,
    userId: req.user.id,
    timestamp: new Date().toISOString(),
  });
}
```

## Database Security

### Connection Security

```javascript
// Use environment variables
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production',
});

// Never hardcode credentials
// BAD: password: 'my_password'
```

### Database User Permissions

```sql
-- Create a limited user for the application
CREATE USER checkops_app WITH PASSWORD 'secure_password';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON forms TO checkops_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON question_bank TO checkops_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON submissions TO checkops_app;
GRANT SELECT, UPDATE ON id_counters TO checkops_app;

-- Don't grant DROP, TRUNCATE, or superuser privileges
```

### Backup and Restore

```bash
# Regular encrypted backups
pg_dump -h localhost -U postgres checkops | \
  openssl enc -aes-256-cbc -salt -out backup.sql.enc

# Restore from encrypted backup
openssl enc -aes-256-cbc -d -in backup.sql.enc | \
  psql -h localhost -U postgres checkops
```

## Network Security

### Firewall Rules

```bash
# Only allow database access from application servers
sudo ufw allow from 10.0.1.0/24 to any port 5432
sudo ufw deny 5432
```

### VPC/Private Network

```javascript
// Use private IP addresses
const checkops = new CheckOps({
  host: '10.0.1.100', // Private IP
  port: 5432,
  // ...
});
```

### Reverse Proxy

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Compliance and Privacy

### GDPR Compliance

```javascript
// Right to erasure (delete user data)
async function deleteUserData(userId) {
  // Find all submissions by user
  const submissions = await checkops.getAllSubmissions();
  const userSubmissions = submissions.filter(
    (s) => s.metadata.userId === userId
  );

  // Delete submissions
  await Promise.all(
    userSubmissions.map((s) => checkops.deleteSubmission(s.id))
  );

  // Log deletion for audit
  logger.info('User data deleted', { userId });
}

// Right to data portability
async function exportUserData(userId) {
  const submissions = await checkops.getAllSubmissions();
  const userSubmissions = submissions.filter(
    (s) => s.metadata.userId === userId
  );

  return {
    submissions: userSubmissions,
    exportDate: new Date().toISOString(),
  };
}
```

### Data Retention

```javascript
// Automatically delete old submissions
async function cleanupOldSubmissions() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 1 year

  const oldSubmissions = await pool.query(
    'SELECT id FROM submissions WHERE submitted_at < $1',
    [cutoffDate]
  );

  for (const sub of oldSubmissions.rows) {
    await checkops.deleteSubmission(sub.id);
  }

  logger.info('Old submissions cleaned up', {
    count: oldSubmissions.rows.length,
  });
}
```

### Audit Logging

```javascript
// Log all sensitive operations
function auditLog(action, details) {
  logger.info('Audit', {
    action,
    userId: details.userId,
    resource: details.resource,
    timestamp: new Date().toISOString(),
    ipAddress: details.ipAddress,
  });
}

// Use in routes
app.delete('/api/forms/:id', requireAuth, async (req, res) => {
  await checkops.deleteForm(req.params.id);

  auditLog('form.delete', {
    userId: req.user.id,
    resource: req.params.id,
    ipAddress: req.ip,
  });

  res.json({ success: true });
});
```

## Security Checklist

### Development

- [ ] Never commit credentials to version control
- [ ] Use environment variables for configuration
- [ ] Implement input validation
- [ ] Use parameterized queries (handled by CheckOps)
- [ ] Sanitize all outputs
- [ ] Implement authentication and authorization
- [ ] Add rate limiting
- [ ] Use HTTPS in production
- [ ] Enable database SSL
- [ ] Implement proper error handling
- [ ] Use security linters (eslint-plugin-security)

### Production

- [ ] Enable SSL/TLS for database connections
- [ ] Use strong passwords (minimum 16 characters)
- [ ] Implement regular backups
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use Web Application Firewall (WAF)
- [ ] Implement DDoS protection
- [ ] Set up intrusion detection
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Compliance checks (GDPR, HIPAA, etc.)

### Monitoring

- [ ] Log all security events
- [ ] Monitor failed login attempts
- [ ] Track API usage patterns
- [ ] Alert on anomalies
- [ ] Regular log reviews
- [ ] Automated security scanning

## Reporting Security Issues

If you discover a security vulnerability, please email security@saiqa.tech with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Please do not** open public GitHub issues for security vulnerabilities.
