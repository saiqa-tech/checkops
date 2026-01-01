# Batch Operations Guide (v3.0.0)

Learn how to leverage CheckOps v3.0.0's high-performance batch operations for efficient bulk processing.

## Overview

CheckOps v3.0.0 introduces optimized batch operations that provide:
- 30-70% performance improvements over individual operations
- Transaction safety with automatic rollback
- Memory-efficient processing for large datasets
- Configurable batch sizes and error handling

## Performance Benefits

| Operation | Individual | Batch | Improvement |
|-----------|------------|-------|-------------|
| Form Creation | 50ms each | 0.30ms each | 99.4% |
| Submission Processing | 25ms each | 0.115ms each | 99.5% |
| Question Creation | 30ms each | 0.20ms each | 99.3% |

## Batch Form Operations

### Bulk Form Creation

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Create multiple forms in a single operation
const formsData = [
    {
        title: 'Customer Feedback Form',
        description: 'Collect customer feedback',
        questions: [
            {
                questionText: 'How satisfied are you?',
                questionType: 'rating',
                required: true,
                validationRules: { min: 1, max: 5 }
            },
            {
                questionText: 'Additional comments',
                questionType: 'textarea',
                required: false
            }
        ],
        metadata: { category: 'feedback', version: '1.0' }
    },
    {
        title: 'Event Registration',
        description: 'Register for upcoming events',
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
            }
        ],
        metadata: { category: 'registration', version: '1.0' }
    }
    // ... up to 100+ forms
];

// Bulk create with automatic transaction management
const createdForms = await checkops.bulkCreateForms(formsData);

console.log(`Successfully created ${createdForms.length} forms`);
createdForms.forEach(form => {
    console.log(`- ${form.title} (ID: ${form.id})`);
});
```

### Error Handling in Batch Operations

```javascript
try {
    const results = await checkops.bulkCreateForms(formsData);
    console.log('All forms created successfully:', results.length);
} catch (error) {
    if (error.name === 'BatchOperationError') {
        console.log('Partial success:');
        console.log(`- Successful: ${error.successful.length}`);
        console.log(`- Failed: ${error.failed.length}`);
        
        // Process successful results
        error.successful.forEach(form => {
            console.log(`✅ Created: ${form.title}`);
        });
        
        // Handle failures
        error.failed.forEach(failure => {
            console.log(`❌ Failed: ${failure.data.title} - ${failure.error}`);
        });
    } else {
        console.error('Batch operation failed completely:', error.message);
    }
}
```

## Batch Submission Operations

### Bulk Submission Creation

```javascript
// Create multiple submissions for a form
const submissionsData = [
    {
        'Full Name': 'John Doe',
        'Email Address': 'john@example.com',
        'How satisfied are you?': 5,
        'Additional comments': 'Great service!'
    },
    {
        'Full Name': 'Jane Smith',
        'Email Address': 'jane@example.com',
        'How satisfied are you?': 4,
        'Additional comments': 'Good experience overall'
    },
    {
        'Full Name': 'Bob Johnson',
        'Email Address': 'bob@example.com',
        'How satisfied are you?': 3,
        'Additional comments': 'Could be better'
    }
    // ... thousands of submissions
];

// Bulk create submissions with optimized performance
const result = await checkops.bulkCreateSubmissions(formId, submissionsData);

console.log('Bulk submission results:');
console.log(`- Successful: ${result.results.length}`);
console.log(`- Errors: ${result.errors.length}`);
console.log(`- Processing time: ${result.processingTime}ms`);

// Handle any errors
if (result.errors.length > 0) {
    console.log('Submission errors:');
    result.errors.forEach((error, index) => {
        console.log(`- Submission ${index}: ${error.message}`);
    });
}
```

### Streaming Large Datasets

```javascript
// For very large datasets, use streaming approach
async function processLargeSubmissionFile(formId, filePath) {
    const fs = require('fs');
    const csv = require('csv-parser');
    
    const batchSize = 1000;
    let batch = [];
    let totalProcessed = 0;
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', async (row) => {
                batch.push(row);
                
                if (batch.length >= batchSize) {
                    try {
                        const result = await checkops.bulkCreateSubmissions(formId, batch);
                        totalProcessed += result.results.length;
                        console.log(`Processed batch: ${totalProcessed} total submissions`);
                        batch = [];
                    } catch (error) {
                        reject(error);
                    }
                }
            })
            .on('end', async () => {
                // Process remaining items
                if (batch.length > 0) {
                    try {
                        const result = await checkops.bulkCreateSubmissions(formId, batch);
                        totalProcessed += result.results.length;
                    } catch (error) {
                        reject(error);
                    }
                }
                resolve(totalProcessed);
            })
            .on('error', reject);
    });
}

// Usage
const totalProcessed = await processLargeSubmissionFile(formId, 'large-dataset.csv');
console.log(`Successfully processed ${totalProcessed} submissions`);
```

## Batch Question Operations

### Bulk Question Creation

```javascript
// Create multiple reusable questions
const questionsData = [
    {
        questionText: 'What is your age?',
        questionType: 'number',
        validationRules: { min: 18, max: 120 },
        metadata: { category: 'demographics' }
    },
    {
        questionText: 'What is your gender?',
        questionType: 'select',
        options: [
            { key: 'male', label: 'Male' },
            { key: 'female', label: 'Female' },
            { key: 'other', label: 'Other' },
            { key: 'prefer_not_to_say', label: 'Prefer not to say' }
        ],
        metadata: { category: 'demographics' }
    },
    {
        questionText: 'What is your occupation?',
        questionType: 'text',
        validationRules: { maxLength: 100 },
        metadata: { category: 'professional' }
    }
    // ... many more questions
];

const createdQuestions = await checkops.bulkCreateQuestions(questionsData);
console.log(`Created ${createdQuestions.length} reusable questions`);
```

### Bulk Question Updates

```javascript
// Update multiple questions at once
const questionUpdates = [
    {
        id: 'question-1',
        updates: {
            questionText: 'Updated question text',
            validationRules: { maxLength: 200 }
        }
    },
    {
        id: 'question-2',
        updates: {
            options: [
                { key: 'option1', label: 'Updated Option 1' },
                { key: 'option2', label: 'Updated Option 2' }
            ]
        }
    }
];

const updatedQuestions = await checkops.bulkUpdateQuestions(questionUpdates);
console.log(`Updated ${updatedQuestions.length} questions`);
```

## Advanced Batch Patterns

### Configurable Batch Processing

```javascript
// Configure batch processing parameters
const batchConfig = {
    batchSize: 500,           // Process 500 items at a time
    maxConcurrency: 3,        // Maximum 3 concurrent batches
    retryAttempts: 3,         // Retry failed items 3 times
    retryDelay: 1000,         // 1 second delay between retries
    continueOnError: true     // Continue processing even if some items fail
};

const result = await checkops.bulkCreateSubmissions(
    formId, 
    submissionsData, 
    batchConfig
);
```

### Progress Tracking

```javascript
// Track progress for long-running batch operations
async function bulkCreateWithProgress(formId, submissions) {
    const batchSize = 100;
    const totalBatches = Math.ceil(submissions.length / batchSize);
    let completedBatches = 0;
    let totalSuccessful = 0;
    let totalErrors = 0;
    
    console.log(`Starting bulk creation: ${submissions.length} submissions in ${totalBatches} batches`);
    
    for (let i = 0; i < submissions.length; i += batchSize) {
        const batch = submissions.slice(i, i + batchSize);
        
        try {
            const result = await checkops.bulkCreateSubmissions(formId, batch);
            totalSuccessful += result.results.length;
            totalErrors += result.errors.length;
            completedBatches++;
            
            const progress = (completedBatches / totalBatches * 100).toFixed(1);
            console.log(`Progress: ${progress}% (${completedBatches}/${totalBatches} batches)`);
            
        } catch (error) {
            console.error(`Batch ${completedBatches + 1} failed:`, error.message);
            totalErrors += batch.length;
        }
    }
    
    return {
        totalProcessed: submissions.length,
        successful: totalSuccessful,
        errors: totalErrors,
        successRate: (totalSuccessful / submissions.length * 100).toFixed(1)
    };
}

const summary = await bulkCreateWithProgress(formId, largeSubmissionArray);
console.log('Bulk operation summary:', summary);
```

### Memory-Efficient Processing

```javascript
// Process large datasets without loading everything into memory
async function* batchProcessor(dataSource, batchSize = 1000) {
    let batch = [];
    
    for await (const item of dataSource) {
        batch.push(item);
        
        if (batch.length >= batchSize) {
            yield batch;
            batch = [];
        }
    }
    
    if (batch.length > 0) {
        yield batch;
    }
}

// Usage with async generator
async function processLargeDataset(formId, dataSource) {
    let totalProcessed = 0;
    
    for await (const batch of batchProcessor(dataSource, 500)) {
        const result = await checkops.bulkCreateSubmissions(formId, batch);
        totalProcessed += result.results.length;
        
        console.log(`Processed batch: ${totalProcessed} total items`);
        
        // Optional: Add delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return totalProcessed;
}
```

## Performance Optimization

### Batch Size Optimization

```javascript
// Find optimal batch size for your use case
async function findOptimalBatchSize(formId, sampleData) {
    const batchSizes = [50, 100, 250, 500, 1000];
    const results = {};
    
    for (const batchSize of batchSizes) {
        const start = performance.now();
        
        try {
            await checkops.bulkCreateSubmissions(
                formId, 
                sampleData.slice(0, batchSize)
            );
            
            const duration = performance.now() - start;
            const throughput = batchSize / (duration / 1000); // items per second
            
            results[batchSize] = {
                duration,
                throughput,
                itemsPerMs: batchSize / duration
            };
            
            console.log(`Batch size ${batchSize}: ${throughput.toFixed(0)} items/sec`);
            
        } catch (error) {
            results[batchSize] = { error: error.message };
        }
    }
    
    // Find optimal batch size
    const optimal = Object.entries(results)
        .filter(([_, result]) => !result.error)
        .sort(([_, a], [__, b]) => b.throughput - a.throughput)[0];
    
    console.log(`Optimal batch size: ${optimal[0]} (${optimal[1].throughput.toFixed(0)} items/sec)`);
    return parseInt(optimal[0]);
}
```

### Connection Pool Optimization

```javascript
// Configure connection pool for batch operations
const checkops = new CheckOps({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Optimized for batch operations
    max: 25,                    // Increased pool size
    min: 5,                     // Minimum connections
    idleTimeoutMillis: 30000,   // Keep connections longer
    acquireTimeoutMillis: 60000, // Longer timeout for batch ops
    
    // Batch-specific settings
    batchSize: 500,             // Default batch size
    maxBatchConcurrency: 3,     // Concurrent batch limit
});
```

## Error Handling Strategies

### Retry Logic

```javascript
async function resilientBulkCreate(formId, submissions, maxRetries = 3) {
    let attempt = 0;
    let lastError;
    
    while (attempt < maxRetries) {
        try {
            return await checkops.bulkCreateSubmissions(formId, submissions);
        } catch (error) {
            attempt++;
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Bulk operation failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

### Partial Failure Recovery

```javascript
async function recoverFromPartialFailure(formId, originalData, failedResult) {
    // Extract failed items for retry
    const failedItems = failedResult.errors.map(error => error.originalData);
    
    console.log(`Retrying ${failedItems.length} failed items...`);
    
    // Retry with smaller batch size
    const retryResult = await checkops.bulkCreateSubmissions(
        formId, 
        failedItems,
        { batchSize: 50 } // Smaller batch size for retry
    );
    
    return {
        totalSuccessful: failedResult.results.length + retryResult.results.length,
        totalFailed: retryResult.errors.length,
        retrySuccessful: retryResult.results.length
    };
}
```

## Monitoring Batch Operations

### Performance Metrics

```javascript
import { recordBatchOperation } from '@saiqa-tech/checkops';

// Automatically track batch operation performance
const monitoredBulkCreate = recordBatchOperation(
    'bulk_create_submissions',
    submissions.length,
    async () => await checkops.bulkCreateSubmissions(formId, submissions)
);

const result = await monitoredBulkCreate();

// Metrics are automatically collected:
// - Operation duration
// - Batch size
// - Success/failure rates
// - Throughput (items per second)
```

### Custom Monitoring

```javascript
class BatchOperationMonitor {
    constructor() {
        this.operations = [];
    }
    
    async monitor(operationName, batchSize, operation) {
        const start = performance.now();
        const startMemory = process.memoryUsage();
        
        try {
            const result = await operation();
            const duration = performance.now() - start;
            const endMemory = process.memoryUsage();
            
            this.operations.push({
                name: operationName,
                batchSize,
                duration,
                throughput: batchSize / (duration / 1000),
                memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
                success: true,
                timestamp: new Date()
            });
            
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            
            this.operations.push({
                name: operationName,
                batchSize,
                duration,
                error: error.message,
                success: false,
                timestamp: new Date()
            });
            
            throw error;
        }
    }
    
    getStats() {
        const successful = this.operations.filter(op => op.success);
        const failed = this.operations.filter(op => !op.success);
        
        return {
            totalOperations: this.operations.length,
            successRate: (successful.length / this.operations.length * 100).toFixed(1),
            averageThroughput: successful.reduce((sum, op) => sum + op.throughput, 0) / successful.length,
            averageDuration: successful.reduce((sum, op) => sum + op.duration, 0) / successful.length,
            totalItemsProcessed: successful.reduce((sum, op) => sum + op.batchSize, 0)
        };
    }
}

// Usage
const monitor = new BatchOperationMonitor();

const result = await monitor.monitor(
    'bulk_submissions',
    submissions.length,
    () => checkops.bulkCreateSubmissions(formId, submissions)
);

console.log('Batch operation stats:', monitor.getStats());
```

This comprehensive guide enables you to leverage CheckOps v3.0.0's powerful batch operations for maximum performance and efficiency in your applications.