# Frequently Asked Questions (FAQ)

Common questions and answers about CheckOps.

## Table of Contents

1. [General Questions](#general-questions)
2. [Installation & Setup](#installation--setup)
3. [Usage Questions](#usage-questions)
4. [Performance & Scalability](#performance--scalability)
5. [Security](#security)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Topics](#advanced-topics)

## General Questions

### What is CheckOps?

CheckOps is an open-source Node.js package for building dynamic forms with centralized question management, structured data submission, and built-in analytics. It uses PostgreSQL with JSONB for flexible, high-performance data storage.

### Is CheckOps free?

Yes! CheckOps is completely free and open source under the Apache 2.0 license. You can use it in commercial projects without any fees.

### What are the main use cases?

- Customer feedback forms
- Surveys and questionnaires
- Registration systems
- Job application forms
- Data collection forms
- Internal forms (IT tickets, expense reports, etc.)

### How is CheckOps different from Google Forms or Typeform?

| Feature | CheckOps | Google Forms | Typeform |
|---------|----------|--------------|----------|
| Cost | Free | Free (limited) | Paid |
| Hosting | Self-hosted | Google-hosted | Typeform-hosted |
| Data Control | Full control | Google owns | Typeform owns |
| Customization | Unlimited | Limited | Moderate |
| Integration | Full API access | Limited API | Limited API |
| For Developers | Yes | No | No |

### What versions of Node.js are supported?

Node.js 18.0.0 or higher. We recommend using the latest LTS version.

### What database is required?

PostgreSQL 12 or higher (PostgreSQL 18 recommended) with JSONB support.

## Installation & Setup

### How do I install CheckOps?

```bash
npm install @saiqa-tech/checkops pg
```

The `pg` package is a peer dependency for PostgreSQL connectivity.

### Do I need to set up a database?

Yes, you need a PostgreSQL database. Create one and run migrations:

```bash
# Create database
createdb checkops

# Run migrations
npm run migrate
```

### Can I use an existing database?

Yes! CheckOps creates its own tables and won't interfere with existing tables. Just point it to your database:

```javascript
const checkops = new CheckOps({
  host: 'localhost',
  database: 'my_existing_db',
  // ... other config
});
```

### What if I don't have PostgreSQL installed?

Install PostgreSQL:

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-14
sudo systemctl start postgresql
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### Can I use Docker for PostgreSQL?

Yes!

```bash
docker run --name checkops-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=checkops \
  -p 5432:5432 \
  -d postgres:14
```

## Usage Questions

### How do I create a simple form?

```javascript
const form = await checkops.createForm({
  title: 'Contact Form',
  questions: [
    { questionText: 'Name', questionType: 'text', required: true },
    { questionText: 'Email', questionType: 'email', required: true },
    { questionText: 'Message', questionType: 'textarea', required: true }
  ]
});
```

### What question types are supported?

- `text` - Single-line text
- `textarea` - Multi-line text
- `number` - Numeric input
- `email` - Email with validation
- `phone` - Phone number
- `date` - Date picker
- `time` - Time picker
- `datetime` - Date and time
- `select` - Dropdown (single choice)
- `multiselect` - Dropdown (multiple choice)
- `radio` - Radio buttons
- `checkbox` - Checkboxes
- `boolean` - Yes/No toggle
- `file` - File upload
- `rating` - Star rating

### How do I reuse questions across forms?

Create questions in the question bank:

```javascript
// Create once
const nameQuestion = await checkops.createQuestion({
  questionText: 'Full Name',
  questionType: 'text'
});

// Use in multiple forms
const form1 = await checkops.createForm({
  title: 'Form 1',
  questions: [{ questionId: nameQuestion.id }]
});

const form2 = await checkops.createForm({
  title: 'Form 2',
  questions: [{ questionId: nameQuestion.id }]
});
```

### How do I handle form submissions?

```javascript
const submission = await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'John Doe',
    'Q-002': 'john@example.com',
    'Q-003': 'Hello world'
  }
});
```

**Important:** Use question IDs as keys, not question text.

### How do I get submission statistics?

```javascript
const stats = await checkops.getSubmissionStats('FORM-001');

console.log('Total submissions:', stats.totalSubmissions);
console.log('Question stats:', stats.questionStats);
```

### Can I update option labels without breaking data?

Yes! (v2.1.0+)

```javascript
await checkops.updateOptionLabel(
  'Q-001',        // Question ID
  'option_red',   // Option key
  'Bright Red',   // New label
  'admin@example.com'
);
```

Existing submissions remain valid because they reference option keys, not labels.

### How do I export submissions to CSV?

```javascript
import { stringify } from 'csv-stringify/sync';

const submissions = await checkops.getSubmissionsByForm('FORM-001');

const csvData = submissions.map(sub => ({
  id: sub.id,
  submittedAt: sub.submittedAt,
  ...sub.submissionData
}));

const csv = stringify(csvData, { header: true });
fs.writeFileSync('submissions.csv', csv);
```

## Performance & Scalability

### How many forms can CheckOps handle?

Thousands of forms without performance issues. The limit is your database capacity, not CheckOps.

### How many submissions can a form have?

Millions. CheckOps uses efficient JSONB indexing and query optimization.

### What's the performance of form creation?

- Single form: ~50ms
- Bulk create (100 forms): ~250ms (20x faster than individual)

### How do I improve performance?

1. **Use batch operations** for bulk data:
   ```javascript
   await checkops.bulkCreateSubmissions(data);
   ```

2. **Monitor cache hit rate**:
   ```javascript
   const stats = checkops.getCacheStats();
   console.log('Hit rate:', stats.total.hitRate);
   ```

3. **Clear caches when needed**:
   ```javascript
   await checkops.clearCache('stats');
   ```

4. **Use pagination**:
   ```javascript
   const submissions = await checkops.getSubmissionsByForm('FORM-001', {
     limit: 100,
     offset: 0
   });
   ```

### Can CheckOps handle high traffic?

Yes! CheckOps is designed for production use with:
- Connection pooling (default: 20 connections)
- Query caching
- Efficient JSONB queries
- Batch operations

For very high traffic, consider:
- Increasing connection pool size
- Using read replicas
- Implementing application-level caching (Redis)

### What's the memory footprint?

Minimal. CheckOps uses:
- ~50MB base memory
- ~1KB per cached form
- ~500 bytes per cached question
- Connection pool memory (configurable)

## Security

### Is CheckOps secure?

Yes! CheckOps includes:
- **SQL Injection Protection:** Parameterized queries
- **XSS Prevention:** Input sanitization
- **Prototype Pollution Protection:** Object sanitization
- **Validation:** Type checking and format validation

### How is user input sanitized?

All inputs are automatically sanitized:

```javascript
// Malicious input
const form = await checkops.createForm({
  title: '<script>alert("xss")</script>',
  questions: [...]
});

// Stored safely (HTML entities encoded)
```

### Should I validate data before submission?

Yes! CheckOps validates data, but you should add application-level validation:

```javascript
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    throw new Error('Invalid email');
  }
}

// Validate before submission
validateEmail(userInput.email);
await checkops.createSubmission({ ... });
```

### How do I implement authentication?

CheckOps doesn't handle authentication. Implement it in your application:

```javascript
// Express.js example
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/forms', requireAuth, async (req, res) => {
  const form = await checkops.createForm({
    ...req.body,
    metadata: { createdBy: req.session.userId }
  });
  res.json({ form });
});
```

### Is data encrypted?

CheckOps doesn't encrypt data by default. For sensitive data:

1. **Use SSL for database connections:**
   ```javascript
   const checkops = new CheckOps({
     ssl: { rejectUnauthorized: true }
   });
   ```

2. **Encrypt at application level:**
   ```javascript
   import crypto from 'crypto';
   
   function encrypt(text) {
     // Your encryption logic
   }
   
   const submission = await checkops.createSubmission({
     formId: 'FORM-001',
     submissionData: {
       'Q-001': encrypt(sensitiveData)
     }
   });
   ```

3. **Use PostgreSQL encryption:**
   ```sql
   CREATE EXTENSION pgcrypto;
   ```

## Troubleshooting

### Error: "CheckOps not initialized"

**Cause:** Forgot to call `initialize()`.

**Solution:**
```javascript
const checkops = new CheckOps(config);
await checkops.initialize();  // Don't forget this!
```

### Error: "Connection refused"

**Cause:** PostgreSQL not running or wrong connection details.

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready

# Verify connection details
psql -h localhost -U postgres -d checkops
```

### Error: "relation does not exist"

**Cause:** Database migrations not run.

**Solution:**
```bash
npm run migrate
```

### Forms are slow to load

**Cause:** Large number of questions or submissions.

**Solution:**
1. Use pagination
2. Check cache hit rate
3. Add database indexes
4. Use batch operations

### High memory usage

**Cause:** Large cache size.

**Solution:**
```javascript
// Check cache size
const stats = checkops.getCacheStats();
console.log('Cache size:', stats.total.size);

// Clear if too large
if (stats.total.size > 10000) {
  await checkops.clearCache('all');
}
```

### Submissions failing validation

**Cause:** Invalid data format or missing required fields.

**Solution:**
```javascript
try {
  await checkops.createSubmission({ ... });
} catch (error) {
  if (error instanceof errors.ValidationError) {
    console.error('Validation failed:', error.details);
    // Show user-friendly error message
  }
}
```

### "Too many clients" error

**Cause:** Connection pool exhausted.

**Solution:**
```javascript
const checkops = new CheckOps({
  max: 50,  // Increase pool size
  min: 5
});
```

## Advanced Topics

### Can I use CheckOps with TypeScript?

Yes! CheckOps works with TypeScript. Type definitions are included:

```typescript
import CheckOps from '@saiqa-tech/checkops';

const checkops: CheckOps = new CheckOps(config);
await checkops.initialize();
```

### Can I extend CheckOps with custom functionality?

Yes! CheckOps is extensible:

```javascript
class CustomCheckOps extends CheckOps {
  async createFormWithNotification(formData) {
    const form = await this.createForm(formData);
    await this.sendNotification(form);
    return form;
  }
  
  async sendNotification(form) {
    // Your notification logic
  }
}
```

### How do I implement multi-tenancy?

Add tenant ID to metadata:

```javascript
// Create form for tenant
const form = await checkops.createForm({
  title: 'Form',
  questions: [...],
  metadata: { tenantId: 'tenant-123' }
});

// Get forms for tenant
const forms = await checkops.getAllForms();
const tenantForms = forms.filter(f => f.metadata.tenantId === 'tenant-123');
```

For better isolation, use PostgreSQL row-level security.

### Can I use CheckOps with GraphQL?

Yes! Create GraphQL resolvers:

```javascript
const resolvers = {
  Query: {
    form: async (_, { id }) => {
      return await checkops.getForm(id);
    },
    forms: async () => {
      return await checkops.getAllForms();
    }
  },
  Mutation: {
    createForm: async (_, { input }) => {
      return await checkops.createForm(input);
    },
    createSubmission: async (_, { input }) => {
      return await checkops.createSubmission(input);
    }
  }
};
```

### How do I implement webhooks?

Wrap CheckOps methods:

```javascript
async function createSubmissionWithWebhook(data) {
  const submission = await checkops.createSubmission(data);
  
  // Trigger webhook
  await fetch('https://your-webhook-url.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'submission.created',
      data: submission
    })
  });
  
  return submission;
}
```

### Can I use CheckOps with serverless functions?

Yes! But be mindful of connection pooling:

```javascript
// Lambda function
let checkops;

export async function handler(event) {
  // Reuse connection across invocations
  if (!checkops) {
    checkops = new CheckOps({
      max: 2,  // Small pool for serverless
      min: 0
    });
    await checkops.initialize();
  }
  
  // Your logic
  const form = await checkops.getForm(event.formId);
  return { statusCode: 200, body: JSON.stringify(form) };
}
```

### How do I monitor CheckOps in production?

Use built-in monitoring (v3.0.0+):

```javascript
import { metricsCollector, getHealthCheckData } from '@saiqa-tech/checkops';

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await getHealthCheckData();
  res.json(health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});

// Alert on high error rate
setInterval(() => {
  const metrics = metricsCollector.getMetrics();
  metrics.operations.forEach((stats, operation) => {
    const errorRate = stats.errors / stats.count;
    if (errorRate > 0.01) {
      sendAlert(`High error rate for ${operation}`);
    }
  });
}, 60000);
```

### Can I contribute to CheckOps?

Yes! We welcome contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

## Still Have Questions?

- **Documentation:** [https://github.com/saiqa-tech/checkops](https://github.com/saiqa-tech/checkops)
- **GitHub Issues:** [https://github.com/saiqa-tech/checkops/issues](https://github.com/saiqa-tech/checkops/issues)
- **Email:** support@saiqa.tech

---

*Last updated: January 2026 (v3.0.0)*
