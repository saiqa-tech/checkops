---
name: checkops-power
description: A comprehensive Kiro Power for integrating CheckOps v3.0.0 - a high-performance, enterprise-grade Node.js package for creating dynamic forms with advanced monitoring, batch operations, intelligent caching, and production-ready capabilities
keywords: 
  - checkops
  - ops checks
  - database monitoring
  - checkops init
  - form builder
  - dynamic forms
  - submission handling
  - performance monitoring
  - batch operations
  - cache management
version: 3.0.0
---

# CheckOps Power v3.0.0

A comprehensive Kiro Power for integrating CheckOps v3.0.0 - a high-performance, enterprise-grade Node.js package for creating dynamic forms with advanced monitoring, batch operations, intelligent caching, and production-ready capabilities.

## Activation Keywords

This power activates when you mention any of these keywords:
- `checkops`
- `ops checks`
- `database monitoring`
- `checkops init`
- `form builder`
- `dynamic forms`
- `submission handling`
- `performance monitoring` (NEW in v3.0.0)
- `batch operations` (NEW in v3.0.0)
- `cache management` (NEW in v3.0.0)

## What This Power Does

The CheckOps Power v3.0.0 provides:

### **Core Features (Enhanced)**
1. **Automated Setup**: Installs `@saiqa-tech/checkops` v3.0.0 and dependencies
2. **Configuration Scaffolding**: Creates optimized `.env` files with advanced settings
3. **Database Migration**: Runs CheckOps database migrations with performance optimizations
4. **Code Generation**: Generates sample code with v3.0.0 features
5. **Best Practices**: Updated steering guides for enterprise deployment

### **NEW v3.0.0 Features**
6. **Performance Monitoring**: Real-time metrics collection and intelligent alerting
7. **Batch Operations**: High-throughput bulk processing capabilities
8. **Advanced Caching**: Intelligent caching with automatic invalidation
9. **Health Monitoring**: Comprehensive system health assessment
10. **Production Analytics**: Performance trends and optimization insights

The CheckOps Power provides complete guidance for integrating CheckOps into Node.js projects with:

1. **Step-by-step Setup**: Complete installation and configuration instructions
2. **Database Configuration**: PostgreSQL setup and migration guidance
3. **Code Examples**: Production-ready code snippets and patterns
4. **Best Practices**: Security, performance, and deployment recommendations
5. **Troubleshooting**: Common issues and solutions
6. **Advanced Patterns**: Complex workflows and enterprise features

## Prerequisites

When activated, this power will:

1. Install CheckOps v3.0.0: `npm install @saiqa-tech/checkops@^3.0.0 pg`
2. Create optimized environment configuration
3. Generate initialization code with monitoring capabilities
4. Run database migrations with performance enhancements
5. Provide sample code for v3.0.0 features (monitoring, batch ops, caching)

## Database Requirements

CheckOps v3.0.0 requires:
- PostgreSQL 18 or higher (recommended for optimal performance)
- JSONB support (PostgreSQL 9.4+)
- Enhanced connection pooling configuration
- Database credentials with appropriate permissions

## Core Features (Enhanced for v3.0.0)

### **High-Performance Form Builder**
Create forms with 60-98% performance improvements over previous versions:
- Sub-millisecond validation and processing
- Optimized N+1 query resolution
- Advanced batch operations for high-throughput scenarios

### **Enterprise Monitoring & Analytics**
Real-time performance monitoring with intelligent alerting:
- Comprehensive metrics collection (queries, operations, cache performance)
- Health status assessment (HEALTHY/WARNING/CRITICAL)
- Performance trend analysis with historical data
- Configurable alerting thresholds

### **Advanced Batch Operations**
Optimized bulk processing capabilities:
- Bulk form creation (30-70% faster than individual operations)
- Bulk submission processing (1000+ submissions in <200ms)
- Bulk question management with transaction safety

### **Intelligent Caching System**
Advanced caching with automatic invalidation:
- LRU cache with configurable TTL
- Cache hit/miss tracking and optimization
- Automatic cache invalidation on data changes
- 90%+ cache hit rates in production scenarios

### **Production-Ready Features**
- Enhanced connection pool management with health monitoring
- Advanced error handling and retry logic
- Comprehensive logging and metrics export
- Health check endpoints for load balancer integration

## Configuration Example (v3.0.0)

```javascript
import CheckOps, { 
    productionMetrics, 
    metricsMiddleware,
    withMonitoring 
} from '@saiqa-tech/checkops';

Before starting, ensure you have:
- Node.js 24+ installed
- PostgreSQL 18+ running and accessible
- npm or yarn package manager
- Database credentials (host, port, database, user, password)

## Step 1: Installation

Install CheckOps and required dependencies:

```bash
npm install @saiqa-tech/checkops pg dotenv
```

For Express.js integration, also install:

```bash
npm install express cors helmet express-rate-limit express-validator
```

## Step 2: Environment Configuration

Create a `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# Optional SSL Configuration
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000

# Application Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Security (generate secure values for production)
JWT_SECRET=your-jwt-secret-change-in-production
ENCRYPTION_KEY=your-encryption-key-change-in-production
CORS_ORIGIN=*
```

## Step 3: Basic Setup and Initialization

Create a basic CheckOps setup file (`checkops-setup.js`):

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create CheckOps instance
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // v3.0.0 Enhanced Configuration
  max: 25, // Enhanced connection pool
  min: 5,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

await checkops.initialize();

// Enable v3.0.0 Monitoring Features
productionMetrics.startMonitoring(60000); // 1-minute intervals
app.use(metricsMiddleware()); // Express middleware for request monitoring
```

## NEW v3.0.0 Workflows

### **1. Performance Monitoring**
```javascript
// Start real-time monitoring
productionMetrics.startMonitoring(30000); // 30-second intervals

// Initialize and test connection
async function setupCheckOps() {
  try {
    console.log('🔌 Connecting to database...');
    await checkops.initialize();
    console.log('✅ CheckOps initialized successfully');
    
    // Test with a simple form creation
    const testForm = {
      title: 'Setup Test Form',
      description: 'Test form to verify CheckOps setup',
      questions: [
        {
          questionText: 'What is your name?',
          questionType: 'text',
          required: true
        }
      ]
    };
    
    const form = await checkops.createForm(testForm);
    console.log(`✅ Test form created with ID: ${form.id}`);
    
    return true;
  } catch (error) {
    console.error('❌ CheckOps setup failed:', error.message);
    return false;
  } finally {
    await checkops.close();
  }
}

// Run setup
setupCheckOps().then(success => {
  if (success) {
    console.log('🎉 CheckOps setup completed successfully!');
  } else {
    console.log('❌ CheckOps setup failed. Check your configuration.');
  }
});
```

Run the setup:
```bash
node checkops-setup.js
```

## Step 4: Basic Usage Examples

### Creating Forms

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function createContactForm() {
  await checkops.initialize();
  
  const contactForm = {
    title: 'Contact Us',
    description: 'Get in touch with our team',
    questions: [
      {
        questionText: 'Full Name',
        questionType: 'text',
        required: true
      },
      {
        questionText: 'Email Address',
        questionType: 'email',
        required: true
      },
      {
        questionText: 'Subject',
        questionType: 'select',
        required: true,
        options: [
          'General Inquiry',
          'Support Request',
          'Sales Question',
          'Partnership',
          'Other'
        ]
      },
      {
        questionText: 'Message',
        questionType: 'textarea',
        required: true
      }
    ]
  };
  
  const form = await checkops.createForm(contactForm);
  console.log('Form created:', form.id);
  
  await checkops.close();
  return form;
}
```

### Handling Submissions

```javascript
async function handleSubmission(formId) {
  await checkops.initialize();
  
  const submission = {
    formId: formId,
    answers: [
      {
        questionId: 'question-id-1', // Get from form.questions[0].id
        value: 'John Doe'
      },
      {
        questionId: 'question-id-2',
        value: 'john@example.com'
      },
      {
        questionId: 'question-id-3',
        value: 'General Inquiry'
      },
      {
        questionId: 'question-id-4',
        value: 'Hello, I would like more information about your services.'
      }
    ],
    metadata: {
      source: 'website',
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.1'
    }
  };
  
  const result = await checkops.createSubmission(submission);
  console.log('Submission created:', result.id);
  
  await checkops.close();
  return result;
}
```

## Step 5: Express.js Integration

Create an Express.js server with CheckOps integration (`server.js`):

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize CheckOps
const checkops = new CheckOps({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Initialize CheckOps on startup
let checkopsInitialized = false;
checkops.initialize().then(() => {
  checkopsInitialized = true;
  console.log('✅ CheckOps initialized');
}).catch(error => {
  console.error('❌ CheckOps initialization failed:', error);
});

// Routes
app.get('/api/health', async (req, res) => {
  try {
    if (!checkopsInitialized) {
      return res.status(503).json({ status: 'unhealthy', error: 'CheckOps not initialized' });
    }
    
    // Test database connection
    await checkops.getAllForms({ limit: 1 });
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Create form
app.post('/api/forms',
  [
    body('title').trim().isLength({ min: 1, max: 200 }).escape(),
    body('description').optional().trim().isLength({ max: 1000 }).escape(),
    body('questions').isArray({ min: 1 }),
    body('questions.*.questionText').trim().isLength({ min: 1, max: 500 }).escape(),
    body('questions.*.questionType').isIn([
      'text', 'textarea', 'email', 'phone', 'number',
      'date', 'time', 'datetime', 'select', 'multiselect',
      'radio', 'checkbox', 'boolean', 'rating', 'file'
    ]),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const form = await checkops.createForm(req.body);
      res.status(201).json({ success: true, data: form });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get form
app.get('/api/forms/:formId',
  param('formId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const form = await checkops.getForm(req.params.formId);
      res.json({ success: true, data: form });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, error: 'Form not found' });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }
);

// Create submission
app.post('/api/forms/:formId/submissions',
  [
    param('formId').isUUID(),
    body('answers').isArray({ min: 1 }),
    body('answers.*.questionId').isUUID(),
    body('answers.*.value').notEmpty(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const submissionData = {
        ...req.body,
        formId: req.params.formId
      };
      
      const submission = await checkops.createSubmission(submissionData);
      res.status(201).json({ success: true, data: submission });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get form submissions
app.get('/api/forms/:formId/submissions',
  param('formId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit = 10, offset = 0 } = req.query;
      const submissions = await checkops.getSubmissions(req.params.formId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      res.json({ success: true, data: submissions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get submission statistics
app.get('/api/forms/:formId/stats',
  param('formId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const stats = await checkops.getSubmissionStats(req.params.formId);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CheckOps server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await checkops.close();
  process.exit(0);
});
```

## Question Types

CheckOps supports the following question types:

- **text**: Single line text input
- **textarea**: Multi-line text input
- **email**: Email address with validation
- **phone**: Phone number input
- **number**: Numeric input
- **date**: Date picker
- **time**: Time picker
- **datetime**: Date and time picker
- **select**: Single selection dropdown
- **multiselect**: Multiple selection
- **radio**: Radio button group
- **checkbox**: Checkbox group
- **boolean**: Yes/No toggle
- **rating**: Star rating (1-5)
- **file**: File upload

## Security Best Practices

1. **Environment Variables**: Never hardcode credentials
2. **Input Validation**: Always validate and sanitize user input
3. **Rate Limiting**: Implement rate limiting on API endpoints
4. **CORS**: Configure CORS appropriately for your domain
5. **HTTPS**: Use HTTPS in production
6. **Database Security**: Use connection pooling and SSL

## Performance Optimization

1. **Connection Pooling**: Configure appropriate pool sizes
2. **Indexing**: Ensure proper database indexing
3. **Caching**: Implement caching for frequently accessed data
4. **Monitoring**: Monitor database performance and query times

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify PostgreSQL is running
   - Check credentials in `.env` file
   - Ensure database exists and user has permissions

2. **Migration Errors**
   - Ensure user has CREATE TABLE permissions
   - Check database version (PostgreSQL 18+ required)
   - Verify network connectivity

3. **Import Errors**
   - Check Node.js version (24+ required)
   - Verify all dependencies are installed
   - Check for syntax errors in configuration

### Database Setup

If you need to create a database and user:

```sql
-- Connect as postgres superuser
CREATE DATABASE your_database_name;
CREATE USER your_database_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE your_database_name TO your_database_user;

-- Connect to your database
\c your_database_name;
GRANT ALL ON SCHEMA public TO your_database_user;
```

// Get comprehensive metrics
const metrics = productionMetrics.exportMetricsReport('json');

// Check system health
const health = productionMetrics.getHealthStatus();
// Returns: { status: 'HEALTHY', details: {...}, alerts: [] }

// Analyze performance trends
const trends = productionMetrics.getPerformanceTrends(60); // Last 60 minutes
```

### **2. Batch Operations**
```javascript
// Bulk form creation (30-70% faster)
const forms = await checkops.bulkCreateForms([
  { title: 'Form 1', questions: [...] },
  { title: 'Form 2', questions: [...] },
  // ... up to 100+ forms
]);

// Bulk submission processing (1000+ submissions in <200ms)
const result = await checkops.bulkCreateSubmissions(formId, [
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' },
  // ... thousands of submissions
]);
```

### **3. Cache Management**
```javascript
// Get cache statistics
const cacheStats = checkops.getCacheStats();
// Returns: { hitRate: 0.95, totalHits: 1500, totalMisses: 75, ... }

// Clear specific cache
await checkops.clearCache('form', formId);

// Clear all caches
await checkops.clearCache('all');
```

### **4. Health Monitoring**
```javascript
// Express health check endpoint
app.get('/health', (req, res) => {
  const health = productionMetrics.getHealthStatus();
  res.status(health.status === 'HEALTHY' ? 200 : 503).json(health);
});

// Metrics endpoint for monitoring systems
app.get('/metrics', (req, res) => {
  const metrics = productionMetrics.exportMetricsReport('text');
  res.set('Content-Type', 'text/plain').send(metrics);
});
```

## Performance Improvements (v3.0.0)

| Operation | v2.x.x | v3.0.0 | Improvement |
|-----------|--------|--------|-------------|
| Form creation (100 questions) | 1900ms | <100ms | 95% |
| Stats calculation (10K submissions) | 5100ms | <2000ms | 60% |
| Memory usage (stats) | 500MB | <50MB | 90% |
| Database queries (form creation) | 101 | <5 | 95% |
| Cache hit rate | 0% | >90% | ∞ |

## Production Deployment (Enhanced)

### **v3.0.0 Environment Variables**
```env
# Enhanced Database Configuration
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=checkops_production
DB_USER=checkops_user
DB_PASSWORD=your-secure-password
DB_SSL=true
DB_MAX_CONNECTIONS=25
DB_MIN_CONNECTIONS=5
DB_IDLE_TIMEOUT=20000
DB_CONNECTION_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000

# v3.0.0 Monitoring Configuration
ENABLE_MONITORING=true
MONITORING_INTERVAL=60000
ALERT_QUERY_TIME_THRESHOLD=1000
ALERT_ERROR_RATE_THRESHOLD=5
ALERT_CACHE_HIT_RATE_THRESHOLD=0.8
ALERT_MEMORY_USAGE_THRESHOLD=500000000

# v3.0.0 Performance Configuration
ENABLE_CACHING=true
CACHE_TTL=300000
BATCH_SIZE_LIMIT=1000
ENABLE_QUERY_OPTIMIZATION=true
```

### **Production Monitoring Setup**
```javascript
// production-monitoring.js
import { productionMetrics, metricsMiddleware } from '@saiqa-tech/checkops';

// Configure alert thresholds
productionMetrics.updateAlertThresholds({
  queryTime: 1000, // 1 second
  errorRate: 5,    // 5%
  cacheHitRate: 0.8, // 80%
  memoryUsage: 500 * 1024 * 1024, // 500MB
});

// Start monitoring with custom interval
productionMetrics.startMonitoring(30000); // 30 seconds

// Express middleware for request monitoring
app.use(metricsMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  const health = productionMetrics.getHealthStatus();
  res.status(health.status === 'HEALTHY' ? 200 : 503).json(health);
});
```

## Support & Documentation

- **GitHub**: https://github.com/saiqa-tech/checkops
- **NPM**: https://www.npmjs.com/package/@saiqa-tech/checkops
- **v3.0.0 Documentation**: Complete API reference with performance monitoring guides
- **Migration Guide**: Detailed upgrade instructions from v2.x.x to v3.0.0
- **Performance Benchmarks**: Real-world performance validation results

For production deployment, refer to the production-deployment steering guide which covers:
- Environment configuration
- Database security
- Performance optimization
- Monitoring and logging
- Docker deployment
- Kubernetes configuration

## Support and Resources

- **GitHub**: https://github.com/saiqa-tech/checkops
- **NPM**: https://www.npmjs.com/package/@saiqa-tech/checkops
- **Documentation**: Complete API reference available
- **Issues**: Report bugs and request features on GitHub

## Next Steps

1. Follow the setup steps above to get CheckOps running
2. Review the steering guides for specific workflows
3. Implement your forms and submission handling
4. Configure production deployment
5. Monitor and optimize performance

This power provides comprehensive guidance for integrating CheckOps into your Node.js applications. Use the steering guides for detailed workflows and best practices.
