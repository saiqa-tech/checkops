# CheckOps v4.0.0 - Test Update Plan

**Date**: January 15, 2026  
**Status**: 📋 Planning

---

## 🎯 Test Update Strategy

### Confirmed Approach: Option B
- Delete old test data
- Create new data with v4 schema
- No migration needed in tests
- Tests assume v4 database schema exists

---

## 🔧 Key Changes Needed

### 1. ID Format Expectations

**v3.x (Old)**:
```javascript
const form = await checkops.createForm({...});
expect(form.id).toMatch(/^FORM-\d+$/);  // SID format
```

**v4.0.0 (New)**:
```javascript
const form = await checkops.createForm({...});
expect(form.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);  // UUID format
expect(form.sid).toMatch(/^FORM-\d+$/);  // SID format
```

### 2. API Calls Use UUID

**v3.x (Old)**:
```javascript
const form = await checkops.createForm({...});
const retrieved = await checkops.getForm(form.id);  // form.id was SID
```

**v4.0.0 (New)**:
```javascript
const form = await checkops.createForm({...});
const retrieved = await checkops.getForm(form.id);  // form.id is now UUID
// Both work the same, just different ID format
```

### 3. Submission Creation

**v3.x (Old)**:
```javascript
const submission = await checkops.createSubmission({
  formId: form.id,  // form.id was SID
  submissionData: {...}
});
```

**v4.0.0 (New)**:
```javascript
const submission = await checkops.createSubmission({
  formId: form.id,  // form.id is now UUID
  submissionData: {...}
});
expect(submission.formId).toBe(form.id);  // UUID
expect(submission.formSid).toBe(form.sid);  // SID
```

### 4. Response Assertions

**v3.x (Old)**:
```javascript
expect(submission).toHaveProperty('id');
expect(submission).toHaveProperty('formId');
```

**v4.0.0 (New)**:
```javascript
expect(submission).toHaveProperty('id');      // UUID
expect(submission).toHaveProperty('sid');     // SID
expect(submission).toHaveProperty('formId');  // UUID
expect(submission).toHaveProperty('formSid'); // SID
```

---

## 📋 Tests to Update

### Unit Tests (Minimal Changes)

**FormService.test.js**:
- ✅ No changes needed (unit tests don't hit database)

**QuestionService.test.js**:
- ✅ No changes needed (unit tests don't hit database)

**SubmissionService.test.js**:
- ✅ No changes needed (unit tests don't hit database)

### Integration Tests (Major Changes)

**formBuilder.integration.test.js**:
- ❌ Update ID format expectations (UUID vs SID)
- ❌ Update assertions to check both `id` and `sid`
- ❌ Verify UUID is used for API calls

**questionBank.integration.test.js**:
- ❌ Update ID format expectations
- ❌ Update assertions to check both `id` and `sid`

**submissions.integration.test.js**:
- ❌ Update ID format expectations
- ❌ Update `formId` to use UUID
- ❌ Add assertions for `formSid`

**options.test.js**:
- ❌ Update ID format expectations

**option-mutations.test.js**:
- ❌ Update ID format expectations

**error-scenarios.test.js**:
- ❌ Update ID format expectations

**critical-path.test.js**:
- ❌ Update ID format expectations
- ❌ Update assertions

**concurrent-operations.test.js**:
- ❌ Update ID format expectations

### Performance Tests (Minor Changes)

**All performance tests**:
- ❌ Update ID format expectations
- ❌ Verify UUID is used for queries

### Load Tests (Minor Changes)

**All load tests**:
- ❌ Update ID format expectations

---

## 🔧 Test Helper Functions

### UUID Validation Helper

```javascript
// tests/helpers/validators.js
export function isUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isSID(str, prefix) {
  const sidRegex = new RegExp(`^${prefix}-\\d+$`);
  return sidRegex.test(str);
}

// Usage in tests
expect(isUUID(form.id)).toBe(true);
expect(isSID(form.sid, 'FORM')).toBe(true);
```

### Test Data Cleanup Helper

```javascript
// tests/helpers/cleanup.js
export async function cleanupTestData(checkops) {
  // Delete all test data
  const forms = await checkops.getAllForms();
  for (const form of forms) {
    await checkops.deleteForm(form.id);  // Use UUID
  }
  
  const questions = await checkops.getAllQuestions();
  for (const question of questions) {
    await checkops.deleteQuestion(question.id);  // Use UUID
  }
}
```

---

## 📊 Test Update Checklist

### Phase 1: Helper Functions
- [ ] Create `tests/helpers/validators.js` with UUID/SID validators
- [ ] Create `tests/helpers/cleanup.js` with cleanup functions
- [ ] Update test setup to use helpers

### Phase 2: Integration Tests
- [ ] Update `formBuilder.integration.test.js`
- [ ] Update `questionBank.integration.test.js`
- [ ] Update `submissions.integration.test.js`
- [ ] Update `options.test.js`
- [ ] Update `option-mutations.test.js`
- [ ] Update `error-scenarios.test.js`
- [ ] Update `critical-path.test.js`
- [ ] Update `concurrent-operations.test.js`

### Phase 3: Performance Tests
- [ ] Update all performance tests to use UUID

### Phase 4: Load Tests
- [ ] Update all load tests to use UUID

### Phase 5: Verification
- [ ] Run all tests
- [ ] Verify all tests pass
- [ ] Check test coverage

---

## 🎯 Example Test Update

### Before (v3.x)

```javascript
describe('Form CRUD Operations', () => {
  it('should create, retrieve, update, and delete a form', async () => {
    const form = await checkops.createForm({
      title: 'Test Form',
      questions: [...]
    });

    expect(form.id).toMatch(/^FORM-\d+$/);  // SID format

    const retrieved = await checkops.getForm(form.id);
    expect(retrieved.title).toBe('Test Form');

    await checkops.deleteForm(form.id);
  });
});
```

### After (v4.0.0)

```javascript
import { isUUID, isSID } from '../../helpers/validators.js';

describe('Form CRUD Operations', () => {
  it('should create, retrieve, update, and delete a form', async () => {
    const form = await checkops.createForm({
      title: 'Test Form',
      questions: [...]
    });

    // Verify both UUID and SID are present
    expect(isUUID(form.id)).toBe(true);
    expect(isSID(form.sid, 'FORM')).toBe(true);

    // Use UUID for API calls
    const retrieved = await checkops.getForm(form.id);
    expect(retrieved.title).toBe('Test Form');
    expect(retrieved.id).toBe(form.id);
    expect(retrieved.sid).toBe(form.sid);

    // Use UUID for deletion
    await checkops.deleteForm(form.id);
  });
});
```

---

## 🚀 Implementation Order

1. **Create helper functions** (validators, cleanup)
2. **Update one integration test** as proof of concept
3. **Run that test** to verify approach works
4. **Update remaining integration tests**
5. **Update performance and load tests**
6. **Run full test suite**

---

**Status**: 📋 Plan Complete - Ready for Implementation

**Next Action**: Create helper functions and update first integration test

