# Migration Guide

This guide helps you migrate between CheckOps versions.

## Table of Contents

1. [Migrating to v3.0.0](#migrating-to-v300)
2. [Migrating to v2.1.0](#migrating-to-v210)
3. [Migrating to v2.0.0](#migrating-to-v200)

## Migrating to v3.0.0

CheckOps v3.0.0 is **fully backward compatible** with v2.x. No breaking changes!

### What's New

1. **Performance Monitoring**
2. **Batch Operations**
3. **Cache Management**
4. **MCP Server Integration**

### Upgrade Steps

#### 1. Update Package

```bash
npm install @saiqa-tech/checkops@^3.0.0
```

#### 2. No Code Changes Required

Your existing code continues to work without modifications:

```javascript
// v2.x code works in v3.0.0
const checkops = new CheckOps(config);
await checkops.initialize();
const form = await checkops.createForm({ ... });
```

#### 3. Optional: Add New Features

Take advantage of new v3.0.0 features:

**Performance Monitoring:**

```javascript
import CheckOps, { metricsCollector } from '@saiqa-tech/checkops';

// Your existing code
await checkops.createForm({ ... });

// New: Get metrics
const metrics = metricsCollector.getMetrics();
console.log('Performance metrics:', metrics);
```

**Batch Operations:**

```javascript
// Old way (still works)
for (const formData of formsData) {
  await checkops.createForm(formData);
}

// New way (20x faster)
const forms = await checkops.bulkCreateForms(formsData);
```

**Cache Management:**

```javascript
// New: Check cache performance
const cacheStats = checkops.getCacheStats();
console.log('Cache hit rate:', cacheStats.total.hitRate);

// New: Clear caches when needed
await checkops.clearCache('stats');
```

### Performance Improvements

v3.0.0 includes automatic performance improvements:

- **Query Caching:** Frequently accessed data is cached automatically
- **Batch Query Optimization:** N+1 queries eliminated
- **Connection Pooling:** Optimized database connections

**No code changes needed** - these improvements are automatic!

### Testing Your Migration

```javascript
// Run your existing test suite
npm test

// All tests should pass without modifications
```

### Rollback Plan

If you need to rollback:

```bash
npm install @saiqa-tech/checkops@^2.1.0
```

No database migrations needed - v3.0.0 uses the same schema as v2.x.

## Migrating to v2.1.0

### What's New

1. **Option Key-Value System**
2. **Option Label Updates**
3. **Option History Tracking**

### Breaking Changes

⚠️ **Option Structure Changed**

**Before (v2.0.0):**
```javascript
options: ['Red', 'Blue', 'Green']
```

**After (v2.1.0):**
```javascript
// Simple options (auto-generates keys)
options: ['Red', 'Blue', 'Green']

// Or structured options (recommended)
options: [
  { key: 'color_red', label: 'Red' },
  { key: 'color_blue', label: 'Blue' },
  { key: 'color_green', label: 'Green' }
]
```

### Upgrade Steps

#### 1. Update Package

```bash
npm install @saiqa-tech/checkops@^2.1.0
```

#### 2. Run Database Migration

```bash
npm run migrate
```

This adds the `option_history` table.

#### 3. Update Code (If Using Structured Options)

**Old Code:**
```javascript
const question = await checkops.createQuestion({
  questionText: 'Select Color',
  questionType: 'select',
  options: ['Red', 'Blue', 'Green']
});
```

**New Code (Recommended):**
```javascript
const question = await checkops.createQuestion({
  questionText: 'Select Color',
  questionType: 'select',
  options: [
    { key: 'color_red', label: 'Red' },
    { key: 'color_blue', label: 'Blue' },
    { key: 'color_green', label: 'Green' }
  ]
});
```

**Note:** Simple arrays still work - keys are auto-generated.

#### 4. Update Submissions (If Using Option Keys)

**Old Code:**
```javascript
await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'Red'  // Using label
  }
});
```

**New Code (Both Work):**
```javascript
// Using label (still works)
await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'Red'
  }
});

// Using key (recommended)
await checkops.createSubmission({
  formId: 'FORM-001',
  submissionData: {
    'Q-001': 'color_red'
  }
});
```

### New Features

#### Update Option Labels

```javascript
// Update a label without breaking existing data
await checkops.updateOptionLabel(
  'Q-001',           // Question ID
  'color_red',       // Option key
  'Bright Red',      // New label
  'admin@example.com' // Changed by
);
```

#### Track Option History

```javascript
// Get history of label changes
const history = await checkops.getOptionHistory('Q-001', 'color_red');

history.forEach(change => {
  console.log(`${change.changedAt}: ${change.oldLabel} → ${change.newLabel}`);
});
```

### Data Migration Script

If you have existing questions with simple options, migrate them:

```javascript
// migrate-options.js
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Get all questions with options
const questions = await checkops.getAllQuestions();

for (const question of questions) {
  if (question.options && Array.isArray(question.options)) {
    // Check if options are simple strings
    const hasSimpleOptions = question.options.every(opt => typeof opt === 'string');
    
    if (hasSimpleOptions) {
      // Convert to structured format
      const structuredOptions = question.options.map(label => ({
        key: `option_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label
      }));
      
      await checkops.updateQuestion(question.id, {
        options: structuredOptions
      });
      
      console.log(`Migrated question ${question.id}`);
    }
  }
}

console.log('Migration complete');
await checkops.close();
```

Run the migration:

```bash
node migrate-options.js
```

## Migrating to v2.0.0

### What's New

1. **Question Bank**
2. **Question Reusability**
3. **Form-Question Relationships**

### Breaking Changes

⚠️ **Question Structure Changed**

**Before (v1.x):**
```javascript
questions: [
  {
    questionText: 'Name',
    questionType: 'text'
  }
]
```

**After (v2.0.0):**
```javascript
// Option 1: Inline questions (still works)
questions: [
  {
    questionText: 'Name',
    questionType: 'text'
  }
]

// Option 2: Reference question bank (recommended)
questions: [
  {
    questionId: 'Q-001'  // Reference to question bank
  }
]
```

### Upgrade Steps

#### 1. Backup Database

```bash
pg_dump -h localhost -U postgres checkops > backup-v1.sql
```

#### 2. Update Package

```bash
npm install @saiqa-tech/checkops@^2.0.0
```

#### 3. Run Database Migration

```bash
npm run migrate
```

This creates the `question_bank` table.

#### 4. Update Code (Optional)

Your v1.x code continues to work, but you can take advantage of the question bank:

**Old Code (Still Works):**
```javascript
const form = await checkops.createForm({
  title: 'Contact Form',
  questions: [
    { questionText: 'Name', questionType: 'text' },
    { questionText: 'Email', questionType: 'email' }
  ]
});
```

**New Code (Recommended):**
```javascript
// Create reusable questions
const nameQuestion = await checkops.createQuestion({
  questionText: 'Name',
  questionType: 'text'
});

const emailQuestion = await checkops.createQuestion({
  questionText: 'Email',
  questionType: 'email'
});

// Use in multiple forms
const form1 = await checkops.createForm({
  title: 'Contact Form',
  questions: [
    { questionId: nameQuestion.id },
    { questionId: emailQuestion.id }
  ]
});

const form2 = await checkops.createForm({
  title: 'Registration Form',
  questions: [
    { questionId: nameQuestion.id },
    { questionId: emailQuestion.id }
  ]
});
```

### Data Migration Script

Migrate existing forms to use question bank:

```javascript
// migrate-to-question-bank.js
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Get all forms
const forms = await checkops.getAllForms();

// Create question bank from existing questions
const questionMap = new Map();

for (const form of forms) {
  for (const question of form.questions) {
    // Create unique key for question
    const key = `${question.questionText}_${question.questionType}`;
    
    if (!questionMap.has(key)) {
      // Create question in bank
      const bankQuestion = await checkops.createQuestion({
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        validationRules: question.validationRules,
        metadata: question.metadata
      });
      
      questionMap.set(key, bankQuestion.id);
    }
  }
}

// Update forms to reference question bank
for (const form of forms) {
  const updatedQuestions = form.questions.map(question => {
    const key = `${question.questionText}_${question.questionType}`;
    return {
      questionId: questionMap.get(key),
      required: question.required
    };
  });
  
  await checkops.updateForm(form.id, {
    questions: updatedQuestions
  });
  
  console.log(`Migrated form ${form.id}`);
}

console.log('Migration complete');
await checkops.close();
```

Run the migration:

```bash
node migrate-to-question-bank.js
```

## Common Migration Issues

### Issue: "CheckOps already initialized"

**Cause:** Calling `initialize()` multiple times.

**Solution:**
```javascript
// Check if already initialized
if (!checkops.initialized) {
  await checkops.initialize();
}
```

### Issue: "Question not found"

**Cause:** Referencing a question ID that doesn't exist.

**Solution:**
```javascript
// Verify question exists
try {
  const question = await checkops.getQuestion('Q-001');
} catch (error) {
  console.error('Question not found');
  // Create question or use inline question
}
```

### Issue: "Invalid option key"

**Cause:** Using option labels instead of keys in v2.1.0+.

**Solution:**
```javascript
// Both work in v2.1.0+
submissionData: {
  'Q-001': 'Red'        // Label (auto-converted)
  'Q-001': 'color_red'  // Key (preferred)
}
```

### Issue: Performance degradation after upgrade

**Cause:** Cache not being utilized.

**Solution:**
```javascript
// Check cache stats
const cacheStats = checkops.getCacheStats();
console.log('Cache hit rate:', cacheStats.total.hitRate);

// If hit rate is low, investigate query patterns
```

## Version Compatibility Matrix

| Feature | v1.x | v2.0.0 | v2.1.0 | v3.0.0 |
|---------|------|--------|--------|--------|
| Basic Forms | ✅ | ✅ | ✅ | ✅ |
| Question Bank | ❌ | ✅ | ✅ | ✅ |
| Option Keys | ❌ | ❌ | ✅ | ✅ |
| Option History | ❌ | ❌ | ✅ | ✅ |
| Performance Monitoring | ❌ | ❌ | ❌ | ✅ |
| Batch Operations | ❌ | ❌ | ❌ | ✅ |
| Cache Management | ❌ | ❌ | ❌ | ✅ |
| MCP Server | ❌ | ❌ | ❌ | ✅ |

## Getting Help

If you encounter issues during migration:

1. Check the [FAQ](./FAQ.md)
2. Review [GitHub Issues](https://github.com/saiqa-tech/checkops/issues)
3. Open a new issue with:
   - Current version
   - Target version
   - Error message
   - Minimal reproduction code

## Rollback Procedures

### Rollback from v3.0.0 to v2.1.0

```bash
npm install @saiqa-tech/checkops@^2.1.0
```

No database changes needed.

### Rollback from v2.1.0 to v2.0.0

```bash
npm install @saiqa-tech/checkops@^2.0.0
```

⚠️ **Warning:** You'll lose option history data.

### Rollback from v2.0.0 to v1.x

```bash
npm install @saiqa-tech/checkops@^1.0.0
```

⚠️ **Warning:** You'll lose question bank data. Restore from backup:

```bash
psql -h localhost -U postgres checkops < backup-v1.sql
```

## Best Practices

1. **Always backup before upgrading**
2. **Test in staging environment first**
3. **Run migrations during low-traffic periods**
4. **Monitor performance after upgrade**
5. **Keep rollback plan ready**
6. **Update dependencies gradually**
7. **Read CHANGELOG.md before upgrading**

## Conclusion

CheckOps maintains strong backward compatibility. Most upgrades require no code changes, and new features are opt-in.

For detailed version changes, see [CHANGELOG.md](../CHANGELOG.md).
