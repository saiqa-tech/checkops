# Production Deployment Guide

Learn how to deploy CheckOps in production environments with proper configuration, security, monitoring, and performance optimization.

## Environment Configuration

### Environment Variables

Create a comprehensive `.env` file for production:

```env
# Database Configuration
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=checkops_production
DB_USER=checkops_user
DB_PASSWORD=your-secure-password
DB_SSL=true
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
CORS_ORIGIN=https://yourdomain.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Production CheckOps Configuration

```javascript
import CheckOps from '@saiqa-tech/checkops';
import dotenv from 'dotenv';

dotenv.config();

const createCheckOpsInstance = () => {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: true, // Secure SSL configuration
      ca: process.env.DB_SSL_CA, // Path to CA certificate
    } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  };

  return new CheckOps(config);
};

export default createCheckOpsInstance;
```

## Database Setup

### Production Database Configuration

```sql
-- Create dedicated database user
CREATE USER checkops_user WITH PASSWORD 'secure_password';

-- Create database
CREATE DATABASE checkops_production OWNER checkops_user;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE checkops_production TO checkops_user;
GRANT USAGE ON SCHEMA public TO checkops_user;
GRANT CREATE ON SCHEMA public TO checkops_user;

-- For existing tables (after migration)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO checkops_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO checkops_user;
```

### Database Migration in Production

```javascript
// production-migrate.js
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

async function runProductionMigration() {
  try {
    console.log('Starting production database migration...');
    
    // Set environment variables for migration
    process.env.DB_HOST = process.env.DB_HOST;
    process.env.DB_PORT = process.env.DB_PORT;
    process.env.DB_NAME = process.env.DB_NAME;
    process.env.DB_USER = process.env.DB_USER;
    process.env.DB_PASSWORD = process.env.DB_PASSWORD;
    
    // Run migration
    execSync('npm run migrate', { stdio: 'inherit' });
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runProductionMigration();
```

## Security Configuration

### Input Validation and Sanitization

```javascript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);

// Form validation middleware
const validateFormCreation = [
  body('title').trim().isLength({ min: 1, max: 200 }).escape(),
  body('description').optional().trim().isLength({ max: 1000 }).escape(),
  body('questions').isArray({ min: 1 }),
  body('questions.*.questionText').trim().isLength({ min: 1, max: 500 }).escape(),
  body('questions.*.questionType').isIn([
    'text', 'textarea', 'email', 'phone', 'number',
    'date', 'time', 'datetime', 'select', 'multiselect',
    'radio', 'checkbox', 'boolean', 'rating', 'file'
  ]),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];
```

### Database Security

```javascript
// Secure database connection with SSL
const secureCheckOpsConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
    key: fs.readFileSync('/path/to/client-key.key').toString(),
    cert: fs.readFileSync('/path/to/client-cert.crt').toString(),
  },
  // Connection pooling for security and performance
  max: 20,
  min: 2,
  acquire: 30000,
  idle: 10000,
};
```

## Performance Optimization

### Connection Pooling

```javascript
class OptimizedCheckOpsService {
  constructor() {
    this.checkops = null;
    this.connectionPool = null;
  }

  async initialize() {
    if (this.checkops) return this.checkops;

    const config = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      
      // Optimized connection pool settings
      max: 20, // Maximum connections
      min: 2,  // Minimum connections
      acquire: 30000, // Maximum time to get connection
      idle: 10000,    // Maximum idle time
      evict: 1000,    // Eviction run interval
      
      // Performance settings
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'checkops-production',
    };

    this.checkops = new CheckOps(config);
    await this.checkops.initialize();
    
    return this.checkops;
  }

  async healthCheck() {
    try {
      await this.checkops.getAllForms({ limit: 1 });
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }
}
```

### Caching Strategy

```javascript
import Redis from 'ioredis';

class CachedCheckOpsService {
  constructor(checkops) {
    this.checkops = checkops;
    this.redis = new Redis(process.env.REDIS_URL);
    this.defaultTTL = 300; // 5 minutes
  }

  async getFormWithCache(formId) {
    const cacheKey = `form:${formId}`;
    
    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Fetch from database
      const form = await this.checkops.getForm(formId);
      
      // Cache the result
      await this.redis.setex(cacheKey, this.defaultTTL, JSON.stringify(form));
      
      return form;
    } catch (error) {
      console.error('Cache error:', error);
      // Fallback to direct database query
      return await this.checkops.getForm(formId);
    }
  }

  async invalidateFormCache(formId) {
    const cacheKey = `form:${formId}`;
    await this.redis.del(cacheKey);
  }

  async getSubmissionStatsWithCache(formId) {
    const cacheKey = `stats:${formId}`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const stats = await this.checkops.getSubmissionStats(formId);
      
      // Cache stats for shorter time (they change frequently)
      await this.redis.setex(cacheKey, 60, JSON.stringify(stats));
      
      return stats;
    } catch (error) {
      console.error('Stats cache error:', error);
      return await this.checkops.getSubmissionStats(formId);
    }
  }
}
```

## Monitoring and Logging

### Structured Logging

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'checkops-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// CheckOps operation logging
class LoggedCheckOpsService {
  constructor(checkops) {
    this.checkops = checkops;
  }

  async createForm(formData) {
    const startTime = Date.now();
    const operationId = this.generateId();
    
    logger.info('Creating form', {
      operationId,
      formTitle: formData.title,
      questionCount: formData.questions?.length || 0,
    });

    try {
      const result = await this.checkops.createForm(formData);
      const duration = Date.now() - startTime;
      
      logger.info('Form created successfully', {
        operationId,
        formId: result.id,
        duration,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Form creation failed', {
        operationId,
        error: error.message,
        duration,
        formData: this.sanitizeFormData(formData),
      });
      
      throw error;
    }
  }

  sanitizeFormData(formData) {
    return {
      title: formData.title,
      questionCount: formData.questions?.length || 0,
      hasDescription: !!formData.description,
    };
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Health Checks and Metrics

```javascript
import express from 'express';
import promClient from 'prom-client';

// Prometheus metrics
const register = new promClient.Registry();

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const checkopsOperations = new promClient.Counter({
  name: 'checkops_operations_total',
  help: 'Total number of CheckOps operations',
  labelNames: ['operation', 'status'],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(checkopsOperations);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const checkops = await getCheckOpsInstance();
    const healthCheck = await checkops.getAllForms({ limit: 1 });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Deployment Strategies

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S checkops -u 1001

# Change ownership
RUN chown -R checkops:nodejs /app
USER checkops

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  checkops-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=checkops_production
      - DB_USER=checkops_user
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - checkops-network

  postgres:
    image: postgres:18-alpine
    environment:
      - POSTGRES_DB=checkops_production
      - POSTGRES_USER=checkops_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - checkops-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - checkops-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - checkops-app
    restart: unless-stopped
    networks:
      - checkops-network

volumes:
  postgres_data:

networks:
  checkops-network:
    driver: bridge
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkops-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: checkops-app
  template:
    metadata:
      labels:
        app: checkops-app
    spec:
      containers:
      - name: checkops-app
        image: your-registry/checkops-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: checkops-secrets
              key: db-host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: checkops-secrets
              key: db-password
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Best Practices

### 1. Security
- Use environment variables for all sensitive configuration
- Implement proper SSL/TLS encryption
- Use connection pooling with appropriate limits
- Implement rate limiting and input validation
- Regular security updates and vulnerability scanning

### 2. Performance
- Implement caching for frequently accessed data
- Use connection pooling for database connections
- Monitor and optimize database queries
- Implement proper indexing on database tables
- Use CDN for static assets

### 3. Monitoring
- Implement comprehensive logging
- Set up health checks and metrics collection
- Monitor database performance and connection pool usage
- Set up alerts for critical errors and performance issues
- Use APM tools for application performance monitoring

### 4. Reliability
- Implement proper error handling and retry logic
- Use circuit breakers for external dependencies
- Set up database backups and disaster recovery
- Implement graceful shutdown procedures
- Use load balancing for high availability

### 5. Scalability
- Design for horizontal scaling
- Use microservices architecture when appropriate
- Implement proper database sharding if needed
- Use message queues for async processing
- Plan for traffic spikes and auto-scaling