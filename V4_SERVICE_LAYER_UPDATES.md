# v4.0.0 Service Layer Updates

## Overview

This document outlines all service layer changes required for the dual-ID system in v4.0.0.

## Key Changes

### 1. ID Resolution
All service methods must:
- Accept both UUID and SID as input
- Use UUID internally for all database operations
- Return SID in responses for user-facing data
- Use `idResolver` utility for ID conversion

### 2. Response Format
All responses must include both `id` (UUID) and `sid` (human-readable):

```javascript
{
  id: '550e8400-e29b-41d4-a716-446655440000',  // UUID for internal use
  sid: 'FORM-001',                              // Human-readable for display
  title: 'Customer Feedback Form',
  ...
}
```

### 3. Foreign Key Handling
- All foreign key lookups use UUID
- Accept SID in input, resolve to UUID before query
- Return SID in nested objects

## Service Updates Required

### FormService.js

#### Methods to Update:
1. `createForm()` - Generate both UUID and SID
2. `getForm(id)` - Accept UUID or SID, return both
3. `getAllForms()` - Return both IDs in all forms
4. `updateForm(id, data)` - Accept UUID or SID
5. `deleteForm(id)` - Accept UUID or SID
6. `activateForm(id)` / `deactivateForm(id)` - Accept UUID or SID
7. `enrichQuestions()` - Use UUID for lookups

#### Example Update:

**Before (v3.x):**
```javascript
async getForm(id) {
  const form = await Form.findById(id);
  return form;
}
```

**After (v4.0.0):**
```javascript
import { resolveToUUID } from '../utils/idResolver.js';

async getForm(id) {
  // Resolve SID to UUID if needed
  const uuid = await resolveToUUID(id, 'forms');
  
  if (!uuid) {
    throw new Error(`Form not found: ${id}`);
  }
  
  const form = await Form.findById(uuid);
  return form; // Form model already includes both id and sid
}
```

### QuestionService.js

#### Methods to Update:
1. `createQuestion()` - Generate both UUID and SID
2. `getQuestion(id)` - Accept UUID or SID
3. `getQuestions(ids)` - Accept array of UUIDs or SIDs
4. `getAllQuestions()` - Return both IDs
5. `updateQuestion(id, data)` - Accept UUID or SID
6. `deleteQuestion(id)` - Accept UUID or SID
7. `activateQuestion(id)` / `deactivateQuestion(id)` - Accept UUID or SID
8. `updateOptionLabel(questionId, ...)` - Accept UUID or SID
9. `getOptionHistory(questionId, ...)` - Accept UUID or SID

#### Example Update:

**Before (v3.x):**
```javascript
async getQuestions(ids) {
  const questions = await Question.findByIds(ids);
  return questions;
}
```

**After (v4.0.0):**
```javascript
import { resolveMultipleToUUID } from '../utils/idResolver.js';

async getQuestions(ids) {
  // Resolve all SIDs to UUIDs
  const uuids = await resolveMultipleToUUID(ids, 'question_bank');
  
  // Filter out nulls (not found)
  const validUuids = uuids.filter(uuid => uuid !== null);
  
  const questions = await Question.findByIds(validUuids);
  return questions; // Question model includes both id and sid
}
```

### SubmissionService.js

#### Methods to Update:
1. `createSubmission()` - Generate UUID and SID, resolve formId
2. `getSubmission(id)` - Accept UUID or SID
3. `getSubmissionsByForm(formId)` - Accept UUID or SID for formId
4. `getAllSubmissions()` - Return both IDs
5. `updateSubmission(id, data)` - Accept UUID or SID
6. `deleteSubmission(id)` - Accept UUID or SID
7. `getSubmissionStats(formId)` - Accept UUID or SID for formId

#### Example Update:

**Before (v3.x):**
```javascript
async createSubmission({ formId, submissionData, metadata = {} }) {
  const submission = await Submission.create({
    formId,
    submissionData,
    metadata
  });
  return submission;
}
```

**After (v4.0.0):**
```javascript
import { resolveToUUID, getNextSIDCounter, generateSID } from '../utils/idResolver.js';

async createSubmission({ formId, submissionData, metadata = {} }) {
  // Resolve formId to UUID (accept both UUID and SID)
  const formUuid = await resolveToUUID(formId, 'forms');
  
  if (!formUuid) {
    throw new Error(`Form not found: ${formId}`);
  }
  
  // Generate SID for new submission
  const counter = await getNextSIDCounter('submission');
  const sid = generateSID('submission', counter);
  
  const submission = await Submission.create({
    sid,  // Pass SID to model
    formId: formUuid,  // Use UUID for foreign key
    submissionData,
    metadata
  });
  
  return submission;
}
```

## Model Updates Required

### Form.js

#### Changes:
1. Add `sid` field to schema
2. Generate UUID automatically (database default)
3. Generate SID on create
4. Include both in `toJSON()`

**Example:**
```javascript
static async create({ title, description, questions, metadata }) {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    
    // Generate SID
    const counter = await getNextSIDCounter('form', client);
    const sid = generateSID('form', counter);
    
    const result = await client.query(
      `INSERT INTO forms (sid, title, description, questions, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sid, title, description, JSON.stringify(questions), JSON.stringify(metadata)]
    );
    
    await client.query('COMMIT');
    
    return new Form(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

toJSON() {
  return {
    id: this.id,           // UUID
    sid: this.sid,         // Human-readable
    title: this.title,
    description: this.description,
    questions: this.questions,
    metadata: this.metadata,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
}
```

### Question.js

#### Changes:
1. Add `sid` field
2. Generate UUID and SID on create
3. Update `findById()` to accept both UUID and SID
4. Update `findByIds()` to accept both
5. Include both in `toJSON()`

### Submission.js

#### Changes:
1. Add `sid` field
2. Add `formSid` field (optional, for reference)
3. Generate UUID and SID on create
4. Resolve `formId` to UUID
5. Include both in `toJSON()`

## Cache Updates

### cache.js

Update cache keys to use UUID internally:

```javascript
// Before
setForm(formId, formData) {
  this.cache.set(`form:${formId}`, formData);
}

// After
setForm(formId, formData) {
  // Cache by UUID (primary)
  this.cache.set(`form:${formData.id}`, formData);
  
  // Also cache by SID for quick lookup
  this.cache.set(`form:sid:${formData.sid}`, formData);
}

getForm(id) {
  // Try UUID first
  if (isUUID(id)) {
    return this.cache.get(`form:${id}`);
  }
  
  // Try SID
  if (isSID(id, 'FORM')) {
    return this.cache.get(`form:sid:${id}`);
  }
  
  return null;
}
```

## Validation Updates

### validation.js

Add ID validation functions:

```javascript
import { isValidID } from './idResolver.js';

export function validateFormId(id) {
  if (!isValidID(id, 'FORM')) {
    throw new ValidationError('Invalid form ID format');
  }
}

export function validateQuestionId(id) {
  if (!isValidID(id, 'Q')) {
    throw new ValidationError('Invalid question ID format');
  }
}

export function validateSubmissionId(id) {
  if (!isValidID(id, 'SUB')) {
    throw new ValidationError('Invalid submission ID format');
  }
}
```

## Batch Operations Updates

### Batch methods must:
1. Accept arrays of UUIDs or SIDs
2. Resolve all to UUIDs before processing
3. Return results with both IDs

**Example:**
```javascript
async bulkCreateForms(formsData) {
  const results = [];
  
  for (const formData of formsData) {
    // Generate SID for each form
    const counter = await getNextSIDCounter('form');
    const sid = generateSID('form', counter);
    
    const form = await this.createForm({
      ...formData,
      _sid: sid  // Internal parameter
    });
    
    results.push(form);
  }
  
  return results;
}
```

## MCP Server Updates

### bin/mcp-server.js

Update all tool handlers to:
1. Accept both UUID and SID in parameters
2. Resolve to UUID before calling service methods
3. Return both IDs in responses

**Example:**
```javascript
case 'get_form': {
  const { formId } = args;
  
  // Validate ID format
  if (!isValidID(formId, 'FORM')) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Invalid form ID format. Use UUID or FORM-XXX format.'
        })
      }]
    };
  }
  
  const form = await this.checkops.getForm(formId);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        data: form  // Includes both id and sid
      })
    }]
  };
}
```

## Testing Updates

### Unit Tests

Add tests for:
1. UUID input handling
2. SID input handling
3. Invalid ID format handling
4. ID resolution
5. Backward compatibility

**Example test:**
```javascript
describe('FormService - Dual ID System', () => {
  it('should accept UUID for getForm', async () => {
    const form = await formService.getForm(uuid);
    expect(form.id).toBe(uuid);
    expect(form.sid).toBe('FORM-001');
  });
  
  it('should accept SID for getForm', async () => {
    const form = await formService.getForm('FORM-001');
    expect(form.id).toBe(uuid);
    expect(form.sid).toBe('FORM-001');
  });
  
  it('should throw error for invalid ID format', async () => {
    await expect(formService.getForm('invalid-id'))
      .rejects.toThrow('Form not found');
  });
});
```

## Migration Checklist

- [ ] Update idResolver.js utility
- [ ] Update Form model
- [ ] Update Question model
- [ ] Update Submission model
- [ ] Update FormService
- [ ] Update QuestionService
- [ ] Update SubmissionService
- [ ] Update cache.js
- [ ] Update validation.js
- [ ] Update MCP server
- [ ] Update unit tests
- [ ] Update integration tests
- [ ] Update documentation
- [ ] Update examples

## Backward Compatibility Notes

### What Works Without Changes:
- All v3.x code using SIDs continues to work
- API accepts both UUID and SID
- Responses include both IDs

### What Requires Updates:
- Code that directly queries database (use service layer)
- Code that assumes ID format (use idResolver utilities)
- Code that caches by ID (update cache keys)

### Deprecation Timeline:
- v4.0.0: Both UUID and SID supported
- v4.x: Recommend using UUID internally
- v5.0.0: Consider deprecating SID-only usage (TBD)

## Performance Considerations

### Optimizations:
1. **Batch ID resolution**: Use `batchResolveToUUID()` for bulk operations
2. **Cache both IDs**: Cache by UUID and SID for fast lookups
3. **Prefer UUID**: Use UUID internally to avoid resolution overhead
4. **Index both columns**: Ensure both `id` and `sid` are indexed

### Expected Impact:
- ID resolution adds ~1-2ms per lookup (cached)
- Batch resolution is more efficient (single query)
- Overall performance improvement from UUID PKs outweighs resolution cost

## Next Steps

1. Implement idResolver utility ✅
2. Update models (Form, Question, Submission)
3. Update services (FormService, QuestionService, SubmissionService)
4. Update cache layer
5. Update MCP server
6. Write tests
7. Update documentation
8. Beta testing
9. Release v4.0.0

---

**Status**: 🟡 In Progress
**Priority**: High
**Breaking Changes**: Yes (database schema)
**API Compatible**: Yes (accepts both formats)
