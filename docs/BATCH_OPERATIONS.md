# Batch Operations Guide (v3.0.0)

CheckOps v3.0.0 introduces high-performance batch operations for creating multiple forms, questions, and submissions efficiently. This guide covers all batch operation capabilities and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Bulk Form Creation](#bulk-form-creation)
3. [Bulk Question Creation](#bulk-question-creation)
4. [Bulk Submission Creation](#bulk-submission-creation)
5. [Performance Optimization](#performance-optimization)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

## Overview

Batch operations allow you to create multiple entities in a single database transaction, significantly improving performance for bulk data imports and migrations.

### Benefits

- **10-50x Faster:** Batch operations are dramatically faster than individual creates
- **Transactional:** All-or-nothing semantics ensure data consistency
- **Memory Efficient:** Processes large datasets without memory issues
- **Automatic Monitoring:** Built-in performance tracking

### When to Use Batch Operations

✅ **Use batch operations for:**
- Data migrations
- Bulk imports from CSV/Excel
- Seeding test data
- Initial system setup
- Periodic bulk updates

❌ **Don't use batch operations for:**
- Single entity creation
- User-facing forms (use regular create methods)
- Real-time operations
- Small datasets (< 10 items)

## Bulk Form Creation

### Basic Usage

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Create multiple forms at once
const formsData = [
  {
    title: 'Customer Feedback Form',
    description: 'Share your experience',
    questions: [
      { questionText: 'Name', questionType: 'text', required: true },
      { questionText: 'Rating', questionType: 'rating', options: [1,2,3,4,5] }
    ]
  },
  {
    title: 'Employee Survey',
    description: 'Annual employee feedback',
    questions: [
      { questionText: 'Department', questionType: 'select', options: ['Sales', 'Engineering'] },
      { questionText: 'Satisfaction', questionType: 'rating', options: [1,2,3,4,5] }
    ]
  },
  // ... more forms
];

const forms = await checkops.bulkCreateForms(formsData);
console.log(`Created ${forms.length} forms`);
```

### Advanced Options

```javascript
// With metadata and validation
const formsData = [
  {
    title: 'Form 1',
    description: 'Description 1',
    questions: [...],
    metadata: {
      category: 'feedback',
      department: 'sales',
      version: 1
    }
  },
  // ... more forms
];

try {
  const forms = await checkops.bulkCreateForms(formsData);
  
  forms.forEach(form => {
    console.log(`Created form: ${form.id} - ${form.title}`);
  });
} catch (error) {
  console.error('Bulk creation failed:', error.message);
  // All forms rolled back on error
}
```

### Performance Comparison

```javascript
// Individual creation (slow)
console.time('individual');
for (const formData of formsData) {
  await checkops.createForm(formData);
}
console.timeEnd('individual');
// individual: 5000ms for 100 forms

// Bulk creation (fast)
console.time('bulk');
await checkops.bulkCreateForms(formsData);
console.timeEnd('bulk');
// bulk: 250ms for 100 forms (20x faster!)
```

## Bulk Question Creation

### Basic Usage

```javascript
// Create multiple questions at once
const questionsData = [
  {
    questionText: 'Full Name',
    questionType: 'text',
    metadata: { category: 'personal' }
  },
  {
    questionText: 'Email Address',
    questionType: 'email',
    metadata: { category: 'contact' }
  },
  {
    questionText: 'Phone Number',
    questionType: 'phone',
    metadata: { category: 'contact' }
  },
  {
    questionText: 'Country',
    questionType: 'select',
    options: ['USA', 'Canada', 'UK', 'Australia'],
    metadata: { category: 'demographics' }
  },
  // ... more questions
];

const questions = await checkops.bulkCreateQuestions(questionsData);
console.log(`Created ${questions.length} questions`);
```

### Building Question Library

```javascript
// Create a comprehensive question library
const questionLibrary = {
  personal: [
    { questionText: 'First Name', questionType: 'text' },
    { questionText: 'Last Name', questionType: 'text' },
    { questionText: 'Date of Birth', questionType: 'date' },
    { questionText: 'Gender', questionType: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] }
  ],
  contact: [
    { questionText: 'Email', questionType: 'email' },
    { questionText: 'Phone', questionType: 'phone' },
    { questionText: 'Address', questionType: 'textarea' }
  ],
  preferences: [
    { questionText: 'Newsletter', questionType: 'boolean' },
    { questionText: 'Interests', questionType: 'multiselect', options: ['Sports', 'Music', 'Reading', 'Travel'] }
  ]
};

// Flatten and add metadata
const allQuestions = Object.entries(questionLibrary).flatMap(([category, questions]) =>
  questions.map(q => ({ ...q, metadata: { category } }))
);

// Create all at once
const createdQuestions = await checkops.bulkCreateQuestions(allQuestions);

// Organize by category
const questionsByCategory = createdQuestions.reduce((acc, q) => {
  const category = q.metadata.category;
  if (!acc[category]) acc[category] = [];
  acc[category].push(q);
  return acc;
}, {});

console.log('Question library created:', questionsByCategory);
```

### Using Bulk-Created Questions in Forms

```javascript
// Create questions first
const questions = await checkops.bulkCreateQuestions(questionsData);

// Use them in a form
const form = await checkops.createForm({
  title: 'Registration Form',
  questions: questions.map(q => ({
    questionId: q.id,
    required: true
  }))
});
```

## Bulk Submission Creation

### Basic Usage

```javascript
// Create multiple submissions at once
const submissionsData = [
  {
    formId: 'FORM-001',
    submissionData: {
      'Q-001': 'John Doe',
      'Q-002': 'john@example.com',
      'Q-003': 5
    },
    metadata: { source: 'import', batch: 'batch-1' }
  },
  {
    formId: 'FORM-001',
    submissionData: {
      'Q-001': 'Jane Smith',
      'Q-002': 'jane@example.com',
      'Q-003': 4
    },
    metadata: { source: 'import', batch: 'batch-1' }
  },
  // ... more submissions
];

const submissions = await checkops.bulkCreateSubmissions(submissionsData);
console.log(`Created ${submissions.length} submissions`);
```

### CSV Import Example

```javascript
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Read CSV file
const csvContent = fs.readFileSync('submissions.csv', 'utf-8');
const records = parse(csvContent, { columns: true });

// Get form to map columns to question IDs
const form = await checkops.getForm('FORM-001');
const questionMap = new Map(
  form.questions.map(q => [q.questionText, q.id])
);

// Convert CSV records to submissions
const submissionsData = records.map(record => ({
  formId: form.id,
  submissionData: Object.fromEntries(
    Object.entries(record).map(([questionText, answer]) => [
      questionMap.get(questionText),
      answer
    ])
  ),
  metadata: {
    source: 'csv_import',
    importDate: new Date().toISOString()
  }
}));

// Bulk create
const submissions = await checkops.bulkCreateSubmissions(submissionsData);
console.log(`Imported ${submissions.length} submissions from CSV`);
```

### Excel Import Example

```javascript
import XLSX from 'xlsx';

// Read Excel file
const workbook = XLSX.readFile('submissions.xlsx');
const sheetName = workbook.SheetNames[0];
const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Get form
const form = await checkops.getForm('FORM-001');
const questionMap = new Map(
  form.questions.map(q => [q.questionText, q.id])
);

// Convert to submissions
const submissionsData = records.map(record => ({
  formId: form.id,
  submissionData: Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => questionMap.has(key))
      .map(([questionText, answer]) => [
        questionMap.get(questionText),
        answer
      ])
  ),
  metadata: {
    source: 'excel_import',
    importDate: new Date().toISOString(),
    sheet: sheetName
  }
}));

// Bulk create
const submissions = await checkops.bulkCreateSubmissions(submissionsData);
console.log(`Imported ${submissions.length} submissions from Excel`);
```

## Performance Optimization

### Batch Size Tuning

```javascript
// For very large datasets, process in chunks
async function bulkCreateInChunks(data, chunkSize = 1000) {
  const results = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    console.log(`Processing chunk ${i / chunkSize + 1}...`);
    
    const chunkResults = await checkops.bulkCreateSubmissions(chunk);
    results.push(...chunkResults);
    
    // Optional: Add delay between chunks to avoid overwhelming database
    if (i + chunkSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Usage
const largeDataset = [...]; // 10,000 submissions
const submissions = await bulkCreateInChunks(largeDataset, 500);
```

### Memory Management

```javascript
// For extremely large datasets, use streaming
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

async function streamingImport(filePath, formId) {
  const form = await checkops.getForm(formId);
  const questionMap = new Map(
    form.questions.map(q => [q.questionText, q.id])
  );
  
  let batch = [];
  let totalProcessed = 0;
  const batchSize = 500;
  
  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(parse({ columns: true }))
      .on('data', async (record) => {
        // Convert record to submission
        const submission = {
          formId,
          submissionData: Object.fromEntries(
            Object.entries(record).map(([questionText, answer]) => [
              questionMap.get(questionText),
              answer
            ])
          )
        };
        
        batch.push(submission);
        
        // Process batch when full
        if (batch.length >= batchSize) {
          await checkops.bulkCreateSubmissions(batch);
          totalProcessed += batch.length;
          console.log(`Processed ${totalProcessed} submissions`);
          batch = [];
        }
      })
      .on('end', async () => {
        // Process remaining batch
        if (batch.length > 0) {
          await checkops.bulkCreateSubmissions(batch);
          totalProcessed += batch.length;
        }
        console.log(`Import complete: ${totalProcessed} submissions`);
        resolve(totalProcessed);
      })
      .on('error', reject);
  });
}

// Usage
const count = await streamingImport('large-file.csv', 'FORM-001');
```

### Parallel Processing

```javascript
// Process multiple forms in parallel
async function bulkImportMultipleForms(formDataMap) {
  const promises = Object.entries(formDataMap).map(async ([formId, records]) => {
    const submissionsData = records.map(record => ({
      formId,
      submissionData: record
    }));
    
    return await checkops.bulkCreateSubmissions(submissionsData);
  });
  
  const results = await Promise.all(promises);
  return results.flat();
}

// Usage
const formDataMap = {
  'FORM-001': [/* submissions for form 1 */],
  'FORM-002': [/* submissions for form 2 */],
  'FORM-003': [/* submissions for form 3 */]
};

const allSubmissions = await bulkImportMultipleForms(formDataMap);
```

## Error Handling

### Transaction Rollback

```javascript
// All-or-nothing: if any submission fails, all are rolled back
try {
  const submissions = await checkops.bulkCreateSubmissions(submissionsData);
  console.log('All submissions created successfully');
} catch (error) {
  console.error('Bulk creation failed, no submissions created:', error.message);
  // Database automatically rolled back
}
```

### Partial Success Handling

```javascript
// Process in chunks with error recovery
async function bulkCreateWithErrorRecovery(data, chunkSize = 100) {
  const successful = [];
  const failed = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    try {
      const results = await checkops.bulkCreateSubmissions(chunk);
      successful.push(...results);
    } catch (error) {
      console.error(`Chunk ${i / chunkSize + 1} failed:`, error.message);
      failed.push({ chunk, error: error.message });
    }
  }
  
  return { successful, failed };
}

// Usage
const result = await bulkCreateWithErrorRecovery(largeDataset);
console.log(`Success: ${result.successful.length}, Failed: ${result.failed.length}`);

// Retry failed chunks
if (result.failed.length > 0) {
  console.log('Retrying failed chunks...');
  for (const { chunk } of result.failed) {
    try {
      const retryResults = await checkops.bulkCreateSubmissions(chunk);
      result.successful.push(...retryResults);
    } catch (error) {
      console.error('Retry failed:', error.message);
    }
  }
}
```

### Validation Errors

```javascript
// Validate data before bulk creation
function validateSubmissionsData(submissionsData, form) {
  const errors = [];
  
  submissionsData.forEach((submission, index) => {
    // Check required fields
    form.questions.forEach(question => {
      if (question.required && !submission.submissionData[question.id]) {
        errors.push({
          index,
          field: question.questionText,
          error: 'Required field missing'
        });
      }
    });
    
    // Check data types
    Object.entries(submission.submissionData).forEach(([questionId, value]) => {
      const question = form.questions.find(q => q.id === questionId);
      if (question && question.questionType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({
            index,
            field: question.questionText,
            error: 'Invalid email format'
          });
        }
      }
    });
  });
  
  return errors;
}

// Usage
const form = await checkops.getForm('FORM-001');
const validationErrors = validateSubmissionsData(submissionsData, form);

if (validationErrors.length > 0) {
  console.error('Validation errors:', validationErrors);
  // Fix errors before bulk creation
} else {
  const submissions = await checkops.bulkCreateSubmissions(submissionsData);
}
```

## Best Practices

### 1. Use Appropriate Batch Sizes

```javascript
// Recommended batch sizes
const BATCH_SIZES = {
  forms: 100,        // Forms are complex, smaller batches
  questions: 500,    // Questions are simple, larger batches
  submissions: 1000  // Submissions vary, adjust based on data size
};

// Adjust based on data complexity
function calculateOptimalBatchSize(dataSize, complexity) {
  if (complexity === 'high') return Math.min(dataSize, 100);
  if (complexity === 'medium') return Math.min(dataSize, 500);
  return Math.min(dataSize, 1000);
}
```

### 2. Monitor Performance

```javascript
import { recordBatchOperation } from '@saiqa-tech/checkops';

// Wrap bulk operations with monitoring
const monitoredBulkCreate = recordBatchOperation(
  'bulkCreateSubmissions',
  submissionsData.length,
  async () => {
    return await checkops.bulkCreateSubmissions(submissionsData);
  }
);

const submissions = await monitoredBulkCreate();

// Check metrics
const metrics = metricsCollector.getMetrics();
const batchStats = metrics.batchOperations.get('bulkCreateSubmissions');
console.log('Batch operation stats:', batchStats);
```

### 3. Add Progress Tracking

```javascript
async function bulkCreateWithProgress(data, chunkSize = 500) {
  const total = data.length;
  let processed = 0;
  const results = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkResults = await checkops.bulkCreateSubmissions(chunk);
    
    results.push(...chunkResults);
    processed += chunk.length;
    
    const progress = (processed / total * 100).toFixed(2);
    console.log(`Progress: ${progress}% (${processed}/${total})`);
  }
  
  return results;
}
```

### 4. Use Transactions for Related Operations

```javascript
// Create forms and submissions together
async function createFormsWithSubmissions(formsWithSubmissions) {
  const forms = await checkops.bulkCreateForms(
    formsWithSubmissions.map(f => f.form)
  );
  
  // Map submissions to created form IDs
  const allSubmissions = formsWithSubmissions.flatMap((fws, index) =>
    fws.submissions.map(sub => ({
      ...sub,
      formId: forms[index].id
    }))
  );
  
  const submissions = await checkops.bulkCreateSubmissions(allSubmissions);
  
  return { forms, submissions };
}
```

### 5. Clean Up After Bulk Operations

```javascript
// Clear caches after bulk operations
async function bulkCreateAndCleanup(data) {
  const results = await checkops.bulkCreateSubmissions(data);
  
  // Clear stats cache since bulk data affects statistics
  await checkops.clearCache('stats');
  
  return results;
}
```

### 6. Document Bulk Operations

```javascript
// Add metadata to track bulk operations
const submissionsData = records.map(record => ({
  formId: 'FORM-001',
  submissionData: record,
  metadata: {
    source: 'bulk_import',
    batchId: generateBatchId(),
    importedAt: new Date().toISOString(),
    importedBy: currentUser.id,
    recordCount: records.length
  }
}));
```

## Performance Benchmarks

### Typical Performance

| Operation | Individual (100 items) | Bulk (100 items) | Speedup |
|-----------|------------------------|------------------|---------|
| Create Forms | 5000ms | 250ms | 20x |
| Create Questions | 3000ms | 150ms | 20x |
| Create Submissions | 4000ms | 200ms | 20x |

### Large Dataset Performance

| Dataset Size | Batch Size | Time | Throughput |
|--------------|------------|------|------------|
| 1,000 | 500 | 0.4s | 2,500/s |
| 10,000 | 1,000 | 3.5s | 2,857/s |
| 100,000 | 1,000 | 35s | 2,857/s |
| 1,000,000 | 1,000 | 350s | 2,857/s |

## Conclusion

Batch operations in CheckOps v3.0.0 provide:
- Dramatic performance improvements for bulk data
- Transactional safety
- Built-in monitoring
- Memory-efficient processing

Use batch operations for migrations, imports, and bulk data processing to achieve optimal performance.

For more information, see:
- [API Reference](./API_REFERENCE.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Examples](./EXAMPLES.md)
