# CheckOps v4.0.0 - Next Steps

**Date**: January 15, 2026  
**Current Status**: Models & Services Complete ✅

---

## 🎯 What's Been Completed

✅ **Architecture Decision**: Option B (Separate UUID/SID methods) confirmed  
✅ **Database Migrations**: Migrations 006-010 created  
✅ **Models**: Form, Question, Submission redesigned  
✅ **Services**: FormService, QuestionService, SubmissionService redesigned  
✅ **Documentation**: Architecture and implementation docs complete  

---

## 🚀 Remaining Work

### Phase 3: API Routes (High Priority)

**Files to Update**:
- `src/routes/forms.js`
- `src/routes/questions.js`
- `src/routes/submissions.js`

**Changes Needed**:
1. Update route parameters from `:id` to `:sid`
2. Replace service calls with SID methods
3. Update request/response handling

**Example**:
```javascript
// Before (v3.x)
router.get('/forms/:id', async (req, res) => {
  const form = await formService.getFormById(req.params.id);
  res.json(form);
});

// After (v4.0.0)
router.get('/forms/:sid', async (req, res) => {
  const form = await formService.getFormBySid(req.params.sid);
  res.json(form);
});

// Submission creation
router.post('/submissions', async (req, res) => {
  const submission = await submissionService.createSubmission({
    formSid: req.body.formSid,  // Changed from formId
    submissionData: req.body.submissionData,
    metadata: req.body.metadata
  });
  res.json(submission);
});
```

---

### Phase 4: MCP Server (High Priority)

**Files to Update**:
- `bin/mcp-server.js`

**Changes Needed**:
1. Update tool parameter names (e.g., `formId` → `formSid`)
2. Replace service calls with SID methods
3. Update tool descriptions and schemas

**Example**:
```javascript
// Before (v3.x)
case 'get_form': {
  const { formId } = args;
  const form = await this.checkops.getFormById(formId);
  return { success: true, data: form };
}

// After (v4.0.0)
case 'get_form': {
  const { formSid } = args;
  const form = await this.checkops.getFormBySid(formSid);
  return { success: true, data: form };
}

case 'create_submission': {
  const { formSid, submissionData, metadata } = args;
  const submission = await this.checkops.createSubmission({
    formSid,  // Changed from formId
    submissionData,
    metadata
  });
  return { success: true, data: submission };
}
```

**Tool Schema Updates**:
```javascript
{
  name: 'get_form',
  description: 'Get a form by SID',
  inputSchema: {
    type: 'object',
    properties: {
      formSid: {  // Changed from formId
        type: 'string',
        description: 'Form SID (e.g., FORM-001)'
      }
    },
    required: ['formSid']
  }
}
```

---

### Phase 5: Tests (High Priority)

**Files to Update**:
- `tests/models/Form.test.js`
- `tests/models/Question.test.js`
- `tests/models/Submission.test.js`
- `tests/services/FormService.test.js`
- `tests/services/QuestionService.test.js`
- `tests/services/SubmissionService.test.js`
- `tests/integration/*.test.js`

**Changes Needed**:
1. Update tests to use separate UUID/SID methods
2. Add new tests for SID methods
3. Update test data to include both UUID and SID
4. Test response format (both UUID and SID returned)

**Example**:
```javascript
describe('Form Model - Dual ID System', () => {
  let testFormUuid;
  let testFormSid;

  beforeEach(async () => {
    const form = await Form.create({
      title: 'Test Form',
      description: 'Test',
      questions: [],
      metadata: {}
    });
    testFormUuid = form.id;
    testFormSid = form.sid;
  });

  describe('findById (UUID)', () => {
    it('should find form by UUID', async () => {
      const form = await Form.findById(testFormUuid);
      expect(form.id).toBe(testFormUuid);
      expect(form.sid).toBe(testFormSid);
    });

    it('should throw NotFoundError for invalid UUID', async () => {
      await expect(Form.findById('invalid-uuid'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('findBySid (SID)', () => {
    it('should find form by SID', async () => {
      const form = await Form.findBySid(testFormSid);
      expect(form.id).toBe(testFormUuid);
      expect(form.sid).toBe(testFormSid);
    });

    it('should throw NotFoundError for invalid SID', async () => {
      await expect(Form.findBySid('FORM-999'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('toJSON', () => {
    it('should return both UUID and SID', async () => {
      const form = await Form.findById(testFormUuid);
      const json = form.toJSON();
      
      expect(json.id).toBe(testFormUuid);
      expect(json.sid).toBe(testFormSid);
      expect(json.title).toBe('Test Form');
    });
  });
});
```

---

### Phase 6: Cache Review (Medium Priority)

**Files to Review**:
- `src/utils/cache.js`

**Current State**:
- Cache operations handle both UUID and SID
- Invalidation clears both UUID and SID entries

**Potential Optimizations**:
1. Review cache key strategy (currently caching by both UUID and SID)
2. Consider caching by SID only (user-facing key)
3. Optimize cache invalidation logic
4. Add cache metrics

**Questions to Answer**:
- Should we cache by UUID, SID, or both?
- What's the cache hit rate for UUID vs SID?
- Is dual-key caching worth the memory overhead?

---

### Phase 7: Migration Execution (High Priority)

**Files to Run**:
- `scripts/migrate-v4.js`

**Steps**:
1. **Backup database** (mandatory!)
2. Run migration script: `npm run migrate:v4`
3. Verify migrations:
   - Check UUID columns exist
   - Check SID columns exist
   - Check foreign keys updated
   - Check form_sid column in submissions
4. Test rollback: `npm run migrate:v4:rollback`
5. Re-run migration if rollback successful

**Migration Checklist**:
- [ ] Database backup created
- [ ] Migration 006: Add UUID columns
- [ ] Migration 007: Migrate foreign keys
- [ ] Migration 008: Swap primary keys
- [ ] Migration 009: Cleanup and optimize
- [ ] Migration 010: Add form_sid to submissions
- [ ] Verify all data migrated correctly
- [ ] Test rollback script
- [ ] Document any issues

---

### Phase 8: Integration Testing (High Priority)

**Test Scenarios**:
1. **Create Form** → Verify both UUID and SID generated
2. **Get Form by SID** → Verify response includes both UUID and SID
3. **Update Form by SID** → Verify update successful
4. **Create Submission with formSid** → Verify submission created with form_sid
5. **Get Submission** → Verify response includes formId and formSid
6. **Get Submissions by formSid** → Verify filtering works
7. **Question Enrichment** → Verify SID-based enrichment works
8. **Stats by formSid** → Verify stats calculation works

**Integration Test Example**:
```javascript
describe('End-to-End: Form Creation and Submission', () => {
  it('should create form, create submission, and retrieve stats', async () => {
    // 1. Create form
    const form = await formService.createForm({
      title: 'Customer Feedback',
      description: 'Please provide feedback',
      questions: [
        {
          questionText: 'How satisfied are you?',
          questionType: 'single_select',
          options: [
            { key: 'very_satisfied', label: 'Very Satisfied' },
            { key: 'satisfied', label: 'Satisfied' }
          ]
        }
      ],
      metadata: {}
    });

    expect(form.id).toBeDefined();  // UUID
    expect(form.sid).toBeDefined();  // SID
    expect(form.sid).toMatch(/^FORM-\d+$/);

    // 2. Create submission using formSid
    const submission = await submissionService.createSubmission({
      formSid: form.sid,  // Use SID
      submissionData: {
        'Q-001': 'very_satisfied'
      },
      metadata: {}
    });

    expect(submission.id).toBeDefined();  // UUID
    expect(submission.sid).toBeDefined();  // SID
    expect(submission.formId).toBe(form.id);  // UUID
    expect(submission.formSid).toBe(form.sid);  // SID

    // 3. Get submissions by formSid
    const submissions = await submissionService.getSubmissionsByFormSid(form.sid);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].sid).toBe(submission.sid);

    // 4. Get stats by formSid
    const stats = await submissionService.getSubmissionStatsBySid(form.sid);
    expect(stats.totalSubmissions).toBe(1);
  });
});
```

---

### Phase 9: Documentation Updates (Medium Priority)

**Files to Update**:
- `README.md` - Update API examples
- `docs/api.md` - Update API documentation
- `docs/migration-guide.md` - Add v4 migration guide
- `CHANGELOG.md` - Document breaking changes
- `examples/` - Update example code

**Key Documentation Points**:
1. Breaking changes in v4.0.0
2. Migration guide from v3.x to v4.0.0
3. New API format (SID-based)
4. Response format (both UUID and SID)
5. Best practices for UUID vs SID usage

---

### Phase 10: Performance Testing (Low Priority)

**Metrics to Measure**:
1. Query performance (UUID vs SID lookups)
2. Cache hit rates (UUID vs SID)
3. Memory usage (dual-key caching)
4. Response times (API endpoints)
5. Database query counts (N+1 issues)

**Tools**:
- `src/utils/metrics.js` - Already implemented
- Performance monitoring dashboard
- Database query analyzer

---

## 📋 Priority Order

1. **Phase 7: Migration Execution** (Do this first to test migrations)
2. **Phase 3: API Routes** (User-facing changes)
3. **Phase 4: MCP Server** (User-facing changes)
4. **Phase 5: Tests** (Ensure everything works)
5. **Phase 8: Integration Testing** (End-to-end validation)
6. **Phase 9: Documentation** (Help users migrate)
7. **Phase 6: Cache Review** (Optimization)
8. **Phase 10: Performance Testing** (Optimization)

---

## 🎯 Success Criteria

### Must Have (Before Release)
- [ ] All migrations run successfully
- [ ] All API routes updated and tested
- [ ] MCP server updated and tested
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Migration guide complete

### Nice to Have (Post-Release)
- [ ] Cache optimization complete
- [ ] Performance benchmarks documented
- [ ] Advanced examples added
- [ ] Video tutorials created

---

## 🚨 Risks and Mitigation

### Risk 1: Data Loss During Migration
**Mitigation**: 
- Mandatory database backup before migration
- Test migration on staging environment first
- Rollback script tested and ready

### Risk 2: Breaking Changes Impact Users
**Mitigation**:
- Clear migration guide
- Deprecation warnings in v3.x
- Support for both formats during transition period (if needed)

### Risk 3: Performance Degradation
**Mitigation**:
- Performance testing before release
- Monitoring in production
- Rollback plan ready

### Risk 4: Cache Inconsistency
**Mitigation**:
- Clear cache invalidation strategy
- Cache versioning
- Monitoring cache hit rates

---

## 📞 Questions to Answer

1. **Should we support both UUID and SID in API routes during transition?**
   - Pro: Easier migration for users
   - Con: More complex code, longer transition period

2. **Should we cache by UUID, SID, or both?**
   - Current: Both (memory overhead)
   - Alternative: SID only (user-facing key)

3. **Should we add a deprecation period for v3.x?**
   - Pro: Smoother transition for users
   - Con: Longer support burden

4. **Should we version the API (e.g., /v4/forms)?**
   - Pro: Clear separation, easier rollback
   - Con: More complex routing

---

## 📝 Notes

- All model and service files have been validated with no diagnostics
- Architecture is clean and follows Option B (separate methods)
- Response format includes both UUID and SID for maximum flexibility
- Database schema supports denormalized form_sid for performance

---

**Status**: Ready for API Routes and MCP Server implementation

**Next Action**: Update API routes to use SID methods

