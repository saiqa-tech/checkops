# CheckOps v4.0.0 - Final Architecture (APPROVED)

**Date**: January 15, 2026  
**Status**: ✅ Architecture Approved - Ready for Implementation

---

## ✅ Approved Architecture Decisions

### 1. API Input (What Users Send)
**Decision**: Accept SID only (user-friendly)

```javascript
// ✅ Users send SID
GET /api/forms/FORM-001
PUT /api/forms/FORM-001
POST /api/submissions {
  formSid: "FORM-001",
  submissionData: {...}
}
```

**Rationale**: SIDs are human-readable and user-friendly

---

### 2. API Output (What Users Receive)
**Decision**: Return BOTH UUID and SID

```javascript
// ✅ Response includes both
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID for API operations
  sid: "FORM-001",                              // SID for display
  title: "Customer Feedback",
  ...
}
```

**Rationale**: 
- UUID: Client can use for subsequent API calls (performance)
- SID: Client can display to users (UX)
- Flexibility: Client chooses what to use

---

### 3. Foreign Keys in Responses
**Decision**: Return BOTH formId (UUID) and formSid (SID)

```javascript
// ✅ Submission response
{
  id: "uuid-submission",
  sid: "SUB-001",
  formId: "uuid-form",       // UUID for API operations
  formSid: "FORM-001",       // SID for display
  submissionData: {...}
}
```

**Rationale**:
- formId (UUID): Client can fetch form directly
- formSid (SID): Client can display form reference to users

---

### 4. Model Methods
**Decision**: Separate methods for UUID and SID

```javascript
// Internal (UUID) - for database operations
static async findById(uuid)
static async updateById(uuid, updates)
static async deleteById(uuid)

// User-facing (SID) - for API operations
static async findBySid(sid)
static async updateBySid(sid, updates)
static async deleteBySid(sid)
```

**Rationale**: Clear separation of concerns, no ambiguity

---

### 5. Database Operations
**Decision**: Always use UUID internally

```sql
-- ✅ All queries use UUID
SELECT * FROM forms WHERE id = $1;  -- UUID
SELECT * FROM submissions WHERE form_id = $1;  -- UUID foreign key
```

**Rationale**: UUID is optimized for database operations

---

### 6. Cache Strategy
**Decision**: Cache by SID (user-facing key)

```javascript
// ✅ Cache by SID
cache.set(`form:${sid}`, form);
cache.get(`form:${sid}`);
```

**Rationale**: SID is the user-facing identifier

---

### 7. Validation
**Decision**: No SID validation needed

**Rationale**: SID is just for display, format doesn't matter for functionality

---

## 📋 Implementation Checklist

### Phase 1: Update Models

#### Form.js
- [ ] Keep `findById(uuid)` - internal use
- [ ] Add `findBySid(sid)` - user-facing
- [ ] Keep `updateById(uuid, updates)` - internal
- [ ] Add `updateBySid(sid, updates)` - user-facing
- [ ] Keep `deleteById(uuid)` - internal
- [ ] Add `deleteBySid(sid)` - user-facing
- [ ] Update `toJSON()` - return both `id` and `sid`
- [ ] Update `findByIds(uuids)` - internal
- [ ] Add `findBySids(sids)` - user-facing

#### Question.js
- [ ] Same changes as Form.js

#### Submission.js
- [ ] Same changes as Form.js
- [ ] Update `create()` - accept `formSid`, resolve to `formId` (UUID)
- [ ] Update `toJSON()` - return both `formId` (UUID) and `formSid` (SID)
- [ ] Update `findByFormSid(formSid)` - user-facing
- [ ] Keep `findByFormId(formUuid)` - internal
- [ ] Add method to populate `formSid` from `formId`

### Phase 2: Update Services

#### FormService.js
- [ ] Update all methods to use `findBySid()` for user input
- [ ] Update `enrichQuestions()` - use SIDs

#### QuestionService.js
- [ ] Update all methods to use `findBySid()` for user input

#### SubmissionService.js
- [ ] Update `createSubmission()` - accept `formSid`
- [ ] Update all methods to use `findBySid()` for user input

### Phase 3: Update Cache
- [ ] Keep cache by SID only
- [ ] Remove dual-key caching logic

### Phase 4: Clean Up
- [ ] Remove unnecessary SID validation
- [ ] Simplify idResolver (keep only what's needed)

---

## 🎯 Key Implementation Details

### Submission Model - Foreign Key Handling

```javascript
export class Submission {
  constructor(data) {
    this.id = data.id;                    // UUID
    this.sid = data.sid;                  // SID
    this.formId = data.formId ?? data.form_id;  // UUID (foreign key)
    this.formSid = data.formSid ?? data.form_sid;  // SID (for display)
    this.submissionData = data.submissionData ?? data.submission_data;
    this.metadata = data.metadata;
    this.submittedAt = data.submittedAt ?? data.submitted_at;
  }

  toJSON() {
    return {
      id: this.id,              // UUID
      sid: this.sid,            // SID
      formId: this.formId,      // UUID (for API operations)
      formSid: this.formSid,    // SID (for display)
      submissionData: this.submissionData,
      metadata: this.metadata,
      submittedAt: this.submittedAt,
    };
  }

  static async create({ formSid, submissionData, metadata = {} }) {
    const pool = getPool();
    
    // Resolve formSid to formId (UUID)
    const form = await Form.findBySid(formSid);
    const formId = form.id;  // UUID for foreign key
    
    // Generate SID for submission
    const counter = await getNextSIDCounter('submission');
    const sid = generateSID('submission', counter);
    
    // Insert with UUID foreign key
    const result = await pool.query(
      `INSERT INTO submissions (sid, form_id, submission_data, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sid, formId, JSON.stringify(submissionData), JSON.stringify(metadata)]
    );
    
    // Populate formSid for response
    const submission = Submission.fromRow(result.rows[0]);
    submission.formSid = form.sid;
    
    return submission;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Submission({
      id: row.id,
      sid: row.sid,
      formId: row.form_id,
      formSid: row.form_sid,  // May be null, needs population
      submissionData: row.submission_data,
      metadata: row.metadata,
      submittedAt: row.submitted_at,
    });
  }
}
```

### Question: Should we store formSid in submissions table?

**Option A**: Store formSid in database
```sql
ALTER TABLE submissions ADD COLUMN form_sid VARCHAR(50);
```
- Pro: No extra query needed
- Con: Denormalization, data duplication

**Option B**: Populate formSid on retrieval
```javascript
const submission = await Submission.findBySid(sid);
const form = await Form.findById(submission.formId);
submission.formSid = form.sid;
```
- Pro: Normalized data
- Con: Extra query

**Which approach should we use?**

---

## ✅ FINAL ARCHITECTURE CONFIRMED

### CheckOps Class (NPM Package Interface)
**Decision**: UUID only

```javascript
// CheckOps class methods accept UUID
async getForm(uuid) {
  return await this.formService.getFormById(uuid);
}

async createSubmission({ formId, submissionData, metadata }) {
  // formId is UUID
  return await this.submissionService.createSubmission({ formId, submissionData, metadata });
}
```

**Rationale**:
- CheckOps is a library used programmatically by developers
- UUID is the database key - more efficient, no resolution needed
- SID is for end-users - display in UI, not for API calls

### Submission Creation
**Decision**: Accept formId (UUID), automatically populate form_sid

```javascript
// Submission.create accepts formId (UUID)
static async create({ formId, submissionData, metadata }) {
  // Get form to populate form_sid
  const form = await Form.findById(formId);
  const formSid = form.sid;
  
  // Insert with both form_id (UUID) and form_sid (VARCHAR)
  await pool.query(
    `INSERT INTO submissions (sid, form_id, form_sid, submission_data, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [sid, formId, formSid, ...]
  );
}
```

**Rationale**:
- Caller provides UUID (efficient)
- Model automatically populates form_sid for denormalization
- Database stores both for flexibility

---

## 🚀 READY FOR IMPLEMENTATION

