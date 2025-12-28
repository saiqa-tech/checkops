# Error Handling Guide

Learn how to properly handle errors and implement robust error handling patterns when using CheckOps in production applications.

## CheckOps Error Types

CheckOps provides structured error handling with specific error types for different scenarios:

### Database Connection Errors
```javascript
import CheckOps, { errors } from '@saiqa-tech/checkops';

try {
  const checkops = new CheckOps({
    host: 'invalid-host',
    port: 5432,
    database: 'test_db',
    user: 'postgres',
    password: 'password',
  });
  
  await checkops.initialize();
} catch (error) {
  if (error.message.includes('Failed to initialize CheckOps')) {
    console.error('Database connection failed:', error.message);
    // Handle connection failure (retry, fallback, etc.)
  }
}
```

### Validation Errors
```javascript
try {
  const form = await checkops.createForm({
    title: '', // Invalid: empty title
    questions: [], // Invalid: no questions
  });
} catch (error) {
  if (error.message.includes('validation')) {
    console.error('Validation error:', error.message);
    // Handle validation errors
  }
}
```

### Not Found Errors
```javascript
try {
  const form = await checkops.getForm('non-existent-id');
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Resource not found:', error.message);
    // Handle missing resources
  }
}
```

## Comprehensive Error Handling Pattern

### Service Layer with Error Handling

```javascript
class FormService {
  constructor(checkops) {
    this.checkops = checkops;
  }

  async createForm(formData) {
    try {
      // Validate input
      this.validateFormData(formData);
      
      // Create form
      const form = await this.checkops.createForm(formData);
      
      return {
        success: true,
        data: form,
        error: null,
      };
    } catch (error) {
      console.error('Form creation failed:', error);
      
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          type: this.getErrorType(error),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getForm(formId) {
    try {
      if (!formId) {
        throw new Error('Form ID is required');
      }

      const form = await this.checkops.getForm(formId);
      
      return {
        success: true,
        data: form,
        error: null,
      };
    } catch (error) {
      console.error('Form retrieval failed:', error);
      
      return {
        success: false,
        data: null,
        error: {
          message: error.message,
          type: this.getErrorType(error),
          formId,
        },
      };
    }
  }

  validateFormData(formData) {
    if (!formData.title || formData.title.trim() === '') {
      throw new Error('Form title is required');
    }
    
    if (!formData.questions || formData.questions.length === 0) {
      throw new Error('At least one question is required');
    }
    
    // Validate each question
    formData.questions.forEach((question, index) => {
      if (!question.questionText || question.questionText.trim() === '') {
        throw new Error(`Question ${index + 1} text is required`);
      }
      
      if (!question.questionType) {
        throw new Error(`Question ${index + 1} type is required`);
      }
    });
  }

  getErrorType(error) {
    if (error.message.includes('connection')) return 'CONNECTION_ERROR';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    if (error.message.includes('not found')) return 'NOT_FOUND_ERROR';
    if (error.message.includes('duplicate')) return 'DUPLICATE_ERROR';
    return 'UNKNOWN_ERROR';
  }
}
```

## Retry Logic for Transient Errors

```javascript
class RetryableCheckOpsService {
  constructor(checkops, maxRetries = 3, retryDelay = 1000) {
    this.checkops = checkops;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async withRetry(operation, ...args) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation.apply(this.checkops, args);
      } catch (error) {
        lastError = error;
        
        // Don't retry validation errors or not found errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          throw new Error(`Operation failed after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        console.warn(`Attempt ${attempt} failed, retrying in ${this.retryDelay}ms:`, error.message);
        await this.delay(this.retryDelay * attempt); // Exponential backoff
      }
    }
    
    throw lastError;
  }

  isNonRetryableError(error) {
    const nonRetryablePatterns = [
      'validation',
      'not found',
      'duplicate',
      'invalid',
      'unauthorized',
    ];
    
    return nonRetryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Wrapper methods with retry logic
  async createForm(formData) {
    return this.withRetry(this.checkops.createForm, formData);
  }

  async createSubmission(submissionData) {
    return this.withRetry(this.checkops.createSubmission, submissionData);
  }

  async getForm(formId) {
    return this.withRetry(this.checkops.getForm, formId);
  }
}
```

## Circuit Breaker Pattern

```javascript
class CircuitBreakerCheckOps {
  constructor(checkops, threshold = 5, timeout = 60000) {
    this.checkops = checkops;
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation.apply(this.checkops, args);
      
      // Success - reset failure count
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
      }
      this.failureCount = 0;
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(`Circuit breaker opened after ${this.failureCount} failures`);
      }
      
      throw error;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
```

## Logging and Monitoring

```javascript
class MonitoredCheckOpsService {
  constructor(checkops, logger) {
    this.checkops = checkops;
    this.logger = logger;
    this.metrics = {
      operations: 0,
      errors: 0,
      avgResponseTime: 0,
    };
  }

  async executeWithMonitoring(operationName, operation, ...args) {
    const startTime = Date.now();
    const operationId = this.generateOperationId();
    
    this.logger.info(`Starting operation: ${operationName}`, {
      operationId,
      args: this.sanitizeArgs(args),
    });

    try {
      const result = await operation.apply(this.checkops, args);
      const duration = Date.now() - startTime;
      
      this.updateMetrics(duration, false);
      
      this.logger.info(`Operation completed: ${operationName}`, {
        operationId,
        duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.updateMetrics(duration, true);
      
      this.logger.error(`Operation failed: ${operationName}`, {
        operationId,
        duration,
        error: error.message,
        stack: error.stack,
      });
      
      throw error;
    }
  }

  updateMetrics(duration, isError) {
    this.metrics.operations++;
    if (isError) this.metrics.errors++;
    
    // Update average response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.operations - 1) + duration) / 
      this.metrics.operations;
  }

  sanitizeArgs(args) {
    // Remove sensitive data from logs
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.submissionData) sanitized.submissionData = '[DATA]';
        return sanitized;
      }
      return arg;
    });
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.operations > 0 ? 
        (this.metrics.errors / this.metrics.operations) * 100 : 0,
    };
  }
}
```

## Express.js Error Middleware

```javascript
// Error handling middleware for Express.js applications
function checkOpsErrorHandler(error, req, res, next) {
  console.error('CheckOps Error:', error);

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: {
      message: 'Internal server error',
      type: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    },
  };

  // Handle specific CheckOps errors
  if (error.message.includes('validation')) {
    statusCode = 400;
    errorResponse.error.message = error.message;
    errorResponse.error.type = 'VALIDATION_ERROR';
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    errorResponse.error.message = 'Resource not found';
    errorResponse.error.type = 'NOT_FOUND_ERROR';
  } else if (error.message.includes('duplicate')) {
    statusCode = 409;
    errorResponse.error.message = 'Resource already exists';
    errorResponse.error.type = 'DUPLICATE_ERROR';
  } else if (error.message.includes('connection')) {
    statusCode = 503;
    errorResponse.error.message = 'Service temporarily unavailable';
    errorResponse.error.type = 'CONNECTION_ERROR';
  }

  res.status(statusCode).json(errorResponse);
}

// Usage in Express app
app.use('/api/forms', formRoutes);
app.use(checkOpsErrorHandler);
```

## Best Practices

### 1. Error Classification
- Categorize errors by type (validation, connection, not found, etc.)
- Use consistent error response formats
- Include relevant context in error messages

### 2. Retry Strategy
- Implement retry logic for transient errors
- Use exponential backoff for retries
- Don't retry validation or authorization errors

### 3. Circuit Breaker
- Implement circuit breaker for external dependencies
- Monitor failure rates and response times
- Provide fallback mechanisms when possible

### 4. Logging and Monitoring
- Log all operations with unique identifiers
- Sanitize sensitive data in logs
- Monitor error rates and performance metrics
- Set up alerts for critical error thresholds

### 5. Graceful Degradation
- Provide fallback responses when CheckOps is unavailable
- Cache frequently accessed data when possible
- Implement health checks for monitoring

### 6. User Experience
- Provide meaningful error messages to users
- Implement proper loading states
- Handle network timeouts gracefully
- Offer retry options for failed operations