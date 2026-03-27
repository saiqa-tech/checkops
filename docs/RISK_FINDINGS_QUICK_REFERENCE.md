# Risk Findings - Quick Reference

## Table Schema

```sql
public.findings (
  id UUID PRIMARY KEY,
  sid VARCHAR(20) UNIQUE,
  submission_id UUID NOT NULL → submissions(id) CASCADE,
  submission_sid VARCHAR(20) NOT NULL,
  question_id UUID NOT NULL → question_bank(id) CASCADE,
  question_sid VARCHAR(20) NOT NULL,
  form_id UUID NOT NULL → forms(id) CASCADE,
  form_sid VARCHAR(20) NOT NULL,
  severity VARCHAR(100),
  department VARCHAR(100),
  observation TEXT,
  root_cause VARCHAR(100),
  evidence_urls TEXT[],
  assignment JSONB DEFAULT '[]',
  status VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
)
```

## API Methods

```javascript
// Create
await checkops.createFinding({
  submissionSid, questionSid, formSid,
  severity, department, observation, rootCause,
  evidenceUrls, assignment, status, metadata, createdBy
})

// Read
await checkops.getFinding(sid)
await checkops.getFindingsByForm(formSid, { limit, offset })
await checkops.getFindingsBySubmission(submissionSid)
await checkops.getFindings({ formSid, severity, department, status, createdAfter, limit })

// Update
await checkops.updateFinding(sid, { severity, department, status, ... })

// Delete
await checkops.deleteFinding(sid)

// Count
await checkops.countFindings({ formSid, severity, department, status })
```

## Common Queries

```sql
-- All findings for a form
SELECT * FROM findings WHERE form_sid = 'FORM-001';

-- Critical findings
SELECT * FROM findings WHERE severity = 'Critical';

-- Findings by department
SELECT * FROM findings WHERE department = 'Operations';

-- Open findings
SELECT * FROM findings WHERE status = 'open';

-- Findings assigned to user
SELECT * FROM findings WHERE assignment @> '[{"user_id": "uuid"}]';

-- Recurring issues
SELECT question_sid, COUNT(*) as count
FROM findings
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY question_sid
HAVING COUNT(*) > 1;
```

## Assignment Structure

```json
[
  { "user_id": "uuid-string", "user_name": "John Doe" },
  { "user_id": "uuid-string", "user_name": "Jane Smith" }
]
```

## Indexes

- `idx_findings_submission_sid` - Fast submission lookups
- `idx_findings_question_sid` - Fast question lookups
- `idx_findings_form_sid` - Fast form lookups
- `idx_findings_severity` - Filter by severity
- `idx_findings_department` - Filter by department
- `idx_findings_status` - Filter by status
- `idx_findings_created_at` - Time-based queries
- `idx_findings_assignment` (GIN) - JSONB queries

## Files

- **Documentation:** `docs/RISK_FINDINGS.md`
- **Migration:** `migrations/016_create_findings_table.sql`
- **Rollback:** `migrations/rollback_findings.sql`
- **Model:** `src/models/Finding.js` (to be created)
- **Summary:** `RISK_FINDINGS_IMPLEMENTATION_SUMMARY.md`
