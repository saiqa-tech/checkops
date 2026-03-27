# Risk Findings Feature

## Overview

The Risk Findings feature extends CheckOps to support structured failure tracking for compliance, audit, and risk management workflows. When a form submission identifies an issue (e.g., failed audit check), a **Finding** entity captures structured metadata about the failure including severity, department, root cause, and assignments.

## Purpose

CheckOps provides the **data structure and storage layer** for findings. The consuming application (e.g., Saiqa-server) handles:
- Business logic and validation rules
- UI/UX for creating and managing findings
- Workflow automation and notifications
- Analytics and reporting dashboards
- Multi-tenancy and access control

## Use Cases

- **Compliance Audits**: Track failed audit checks with severity and department
- **Quality Inspections**: Record quality issues with root cause analysis
- **Safety Inspections**: Document safety violations with evidence
- **Operational Checks**: Monitor operational failures with recurrence tracking
- **Risk Management**: Categorize and assign risks for resolution

## Architecture

### Data Model

Findings are stored in a dedicated `findings` table with relationships to existing CheckOps entities:

```
findings (N) ──→ (1) submissions
findings (N) ──→ (1) question_bank
findings (N) ──→ (1) forms
```

### Key Principles

1. **Data Layer Only**: CheckOps stores and retrieves finding data
2. **No Validation**: Field values are stored as-is (strings, arrays)
3. **No Business Logic**: Consuming app enforces rules and workflows
4. **Query Optimized**: Indexes support efficient filtering and reporting
5. **Flexible Schema**: JSONB fields allow extensibility


## Database Schema

### Findings Table

```sql
CREATE TABLE public.findings (
  -- IDs (dual-ID system)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sid VARCHAR(20) UNIQUE NOT NULL,
  
  -- Foreign Keys (all required, cascade delete)
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_sid VARCHAR(20) NOT NULL,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  question_sid VARCHAR(20) NOT NULL,
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_sid VARCHAR(20) NOT NULL,
  
  -- Finding Data (all nullable - consuming app enforces requirements)
  severity VARCHAR(100),           -- e.g., "Minor", "Major", "Critical"
  department VARCHAR(100),         -- e.g., "Operations", "Maintenance"
  observation TEXT,                -- What was observed
  root_cause VARCHAR(100),         -- Why it happened
  evidence_urls TEXT[],            -- Array of evidence URLs
  assignment JSONB DEFAULT '[]',   -- Array of assignment objects
  status VARCHAR(50),              -- e.g., "open", "in_progress", "resolved", "closed"
  
  -- System Fields
  metadata JSONB DEFAULT '{}',     -- Extensibility
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);
```

### Indexes

```sql
-- Primary lookup indexes
CREATE INDEX idx_findings_submission_sid ON public.findings(submission_sid);
CREATE INDEX idx_findings_question_sid ON public.findings(question_sid);
CREATE INDEX idx_findings_form_sid ON public.findings(form_sid);

-- Query/filter indexes
CREATE INDEX idx_findings_severity ON public.findings(severity);
CREATE INDEX idx_findings_department ON public.findings(department);
CREATE INDEX idx_findings_status ON public.findings(status);
CREATE INDEX idx_findings_created_at ON public.findings(created_at DESC);

-- Assignment query index (GIN for JSONB)
CREATE INDEX idx_findings_assignment ON public.findings USING GIN (assignment);
```

### SID Counter

```sql
INSERT INTO sid_counters (entity_type, counter) 
VALUES ('finding', 0) 
ON CONFLICT (entity_type) DO NOTHING;
```


## Field Descriptions

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | NOT NULL | Internal primary key (auto-generated) |
| `sid` | VARCHAR(20) | NOT NULL | Human-readable ID (FND-001, FND-002, etc.) |
| `submission_id` | UUID | NOT NULL | Foreign key to submissions table (UUID) |
| `submission_sid` | VARCHAR(20) | NOT NULL | Denormalized submission SID for fast queries |
| `question_id` | UUID | NOT NULL | Foreign key to question_bank table (UUID) |
| `question_sid` | VARCHAR(20) | NOT NULL | Denormalized question SID for fast queries |
| `form_id` | UUID | NOT NULL | Foreign key to forms table (UUID) |
| `form_sid` | VARCHAR(20) | NOT NULL | Denormalized form SID for fast queries |
| `severity` | VARCHAR(100) | NULL | Severity level (e.g., "Minor", "Major", "Critical") |
| `department` | VARCHAR(100) | NULL | Department/category (e.g., "Operations", "Maintenance") |
| `observation` | TEXT | NULL | Description of what was observed |
| `root_cause` | VARCHAR(100) | NULL | Analysis of why the issue occurred |
| `evidence_urls` | TEXT[] | NULL | Array of URLs pointing to evidence (photos, documents) |
| `assignment` | JSONB | NOT NULL | Array of assignment objects (default: `[]`) |
| `status` | VARCHAR(50) | NULL | Current status (e.g., "open", "in_progress", "resolved", "closed") |
| `metadata` | JSONB | NOT NULL | Additional metadata for extensibility (default: `{}`) |
| `created_at` | TIMESTAMP | NOT NULL | Timestamp when finding was created (auto-generated) |
| `created_by` | VARCHAR(100) | NULL | Identifier of user who created the finding |

### Assignment Field Structure

The `assignment` field is a JSONB array of objects. CheckOps does not enforce structure, but the documented format is:

```json
[
  {
    "user_id": "uuid-string",
    "user_name": "John Doe"
  },
  {
    "user_id": "uuid-string",
    "user_name": "Jane Smith"
  }
]
```

**Note:** Consuming applications can extend this structure with additional fields (e.g., `assigned_at`, `role`, `status`).


## Cascade Delete Behavior

When parent records are deleted, findings are automatically deleted:

| Parent Deleted | Behavior | Rationale |
|----------------|----------|-----------|
| Form | `ON DELETE CASCADE` | Findings are meaningless without the form context |
| Submission | `ON DELETE CASCADE` | Findings are tied to specific submission instances |
| Question | `ON DELETE CASCADE` | Findings reference specific questions |

**Example:**
```sql
-- Deleting a form deletes all its submissions and findings
DELETE FROM forms WHERE sid = 'FORM-001';
-- Automatically deletes all submissions for FORM-001
-- Automatically deletes all findings for those submissions
```

## Recurrence Analysis

CheckOps does not compute recurrence automatically. The consuming application can query for recurrence:

```sql
-- Find recurring issues (same question failed multiple times)
SELECT 
  question_sid,
  form_sid,
  COUNT(*) as occurrence_count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM findings
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY question_sid, form_sid
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;
```

**Frequency = Number of Records**: The consuming application determines what constitutes "recurring" based on count and timeframe.


## Model Class Structure

The `Finding` model follows the same dual-ID pattern as other CheckOps models.

### Finding.js

```javascript
/**
 * Finding Model - v4.0.0 Dual-ID System
 * 
 * This model uses the dual-ID system:
 * - id (UUID): Internal primary key for database operations
 * - sid (VARCHAR): Human-readable ID (FND-001) for user-facing operations
 */

import { getPool } from '../config/database.js';
import { generateSID, getNextSIDCounter } from '../utils/idResolver.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';

export class Finding {
  constructor(data) {
    this.id = data.id;
    this.sid = data.sid;
    this.submissionId = data.submissionId ?? data.submission_id;
    this.submissionSid = data.submissionSid ?? data.submission_sid;
    this.questionId = data.questionId ?? data.question_id;
    this.questionSid = data.questionSid ?? data.question_sid;
    this.formId = data.formId ?? data.form_id;
    this.formSid = data.formSid ?? data.form_sid;
    this.severity = data.severity;
    this.department = data.department;
    this.observation = data.observation;
    this.rootCause = data.rootCause ?? data.root_cause;
    this.evidenceUrls = data.evidenceUrls ?? data.evidence_urls;
    this.assignment = data.assignment;
    this.status = data.status;
    this.metadata = data.metadata;
    this.createdAt = data.createdAt ?? data.created_at;
    this.createdBy = data.createdBy ?? data.created_by;
  }

  toJSON() {
    return {
      id: this.id,
      sid: this.sid,
      submissionId: this.submissionId,
      submissionSid: this.submissionSid,
      questionId: this.questionId,
      questionSid: this.questionSid,
      formId: this.formId,
      formSid: this.formSid,
      severity: this.severity,
      department: this.department,
      observation: this.observation,
      rootCause: this.rootCause,
      evidenceUrls: this.evidenceUrls,
      assignment: this.assignment,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
    };
  }

  static fromRow(row) {
    if (!row) return null;
    return new Finding({
      id: row.id,
      sid: row.sid,
      submissionId: row.submission_id,
      submissionSid: row.submission_sid,
      questionId: row.question_id,
      questionSid: row.question_sid,
      formId: row.form_id,
      formSid: row.form_sid,
      severity: row.severity,
      department: row.department,
      observation: row.observation,
      rootCause: row.root_cause,
      evidenceUrls: row.evidence_urls,
      assignment: row.assignment,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      createdBy: row.created_by,
    });
  }
}
```


### CRUD Methods

```javascript
/**
 * Create finding
 */
static async create({
  submissionSid,
  questionSid,
  formSid,
  severity = null,
  department = null,
  observation = null,
  rootCause = null,
  evidenceUrls = null,
  assignment = [],
  status = null,
  metadata = {},
  createdBy = null
}) {
  const pool = getPool();
  
  // Get UUIDs from SIDs
  const submission = await Submission.findBySid(submissionSid);
  const question = await Question.findBySid(questionSid);
  const form = await Form.findBySid(formSid);
  
  // Generate SID
  const counter = await getNextSIDCounter('finding');
  const sid = generateSID('finding', counter);
  
  const result = await pool.query(
    `INSERT INTO findings (
      sid, submission_id, submission_sid, question_id, question_sid,
      form_id, form_sid, severity, department, observation, root_cause,
      evidence_urls, assignment, status, metadata, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      sid, submission.id, submissionSid, question.id, questionSid,
      form.id, formSid, severity, department, observation, rootCause,
      evidenceUrls, JSON.stringify(assignment), status, JSON.stringify(metadata), createdBy
    ]
  );
  
  return Finding.fromRow(result.rows[0]);
}

/**
 * Find finding by SID (user-facing)
 */
static async findBySid(sid) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM findings WHERE sid = $1', [sid]);
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Finding', sid);
  }
  
  return Finding.fromRow(result.rows[0]);
}

/**
 * Find finding by UUID (internal use)
 */
static async findById(uuid) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM findings WHERE id = $1', [uuid]);
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Finding', uuid);
  }
  
  return Finding.fromRow(result.rows[0]);
}
```


/**
 * Find findings by form SID
 */
static async findByFormSid(formSid, { limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM findings WHERE form_sid = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [formSid, limit, offset]
  );
  
  return result.rows.map(row => Finding.fromRow(row));
}

/**
 * Find findings by submission SID
 */
static async findBySubmissionSid(submissionSid) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM findings WHERE submission_sid = $1 ORDER BY created_at DESC',
    [submissionSid]
  );
  
  return result.rows.map(row => Finding.fromRow(row));
}

/**
 * Find findings by question SID
 */
static async findByQuestionSid(questionSid, { limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM findings WHERE question_sid = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [questionSid, limit, offset]
  );
  
  return result.rows.map(row => Finding.fromRow(row));
}

/**
 * Find findings with filters (for reporting)
 */
static async findAll({
  formSid = null,
  severity = null,
  department = null,
  status = null,
  createdAfter = null,
  createdBefore = null,
  limit = 100,
  offset = 0
} = {}) {
  const pool = getPool();
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;
  
  if (formSid) {
    whereClauses.push(`form_sid = $${paramIndex++}`);
    params.push(formSid);
  }
  
  if (severity) {
    whereClauses.push(`severity = $${paramIndex++}`);
    params.push(severity);
  }
  
  if (department) {
    whereClauses.push(`department = $${paramIndex++}`);
    params.push(department);
  }
  
  if (status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  
  if (createdAfter) {
    whereClauses.push(`created_at >= $${paramIndex++}`);
    params.push(createdAfter);
  }
  
  if (createdBefore) {
    whereClauses.push(`created_at <= $${paramIndex++}`);
    params.push(createdBefore);
  }
  
  let query = 'SELECT * FROM findings';
  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  return result.rows.map(row => Finding.fromRow(row));
}
```


/**
 * Update finding by SID
 */
static async updateBySid(sid, updates) {
  const pool = getPool();
  const finding = await Finding.findBySid(sid);
  
  const setClauses = [];
  const values = [];
  let paramIndex = 1;
  
  if (updates.severity !== undefined) {
    setClauses.push(`severity = $${paramIndex++}`);
    values.push(updates.severity);
  }
  
  if (updates.department !== undefined) {
    setClauses.push(`department = $${paramIndex++}`);
    values.push(updates.department);
  }
  
  if (updates.observation !== undefined) {
    setClauses.push(`observation = $${paramIndex++}`);
    values.push(updates.observation);
  }
  
  if (updates.rootCause !== undefined) {
    setClauses.push(`root_cause = $${paramIndex++}`);
    values.push(updates.rootCause);
  }
  
  if (updates.evidenceUrls !== undefined) {
    setClauses.push(`evidence_urls = $${paramIndex++}`);
    values.push(updates.evidenceUrls);
  }
  
  if (updates.assignment !== undefined) {
    setClauses.push(`assignment = $${paramIndex++}`);
    values.push(JSON.stringify(updates.assignment));
  }
  
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }
  
  if (setClauses.length === 0) {
    return finding;
  }
  
  values.push(sid);
  const query = `UPDATE findings SET ${setClauses.join(', ')} WHERE sid = $${paramIndex} RETURNING *`;
  
  const result = await pool.query(query, values);
  return Finding.fromRow(result.rows[0]);
}

/**
 * Delete finding by SID
 */
static async deleteBySid(sid) {
  const pool = getPool();
  const finding = await Finding.findBySid(sid);
  
  await pool.query('DELETE FROM findings WHERE sid = $1', [sid]);
  return finding;
}

/**
 * Count findings
 */
static async count({ formSid = null, severity = null, department = null, status = null } = {}) {
  const pool = getPool();
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;
  
  if (formSid) {
    whereClauses.push(`form_sid = $${paramIndex++}`);
    params.push(formSid);
  }
  
  if (severity) {
    whereClauses.push(`severity = $${paramIndex++}`);
    params.push(severity);
  }
  
  if (department) {
    whereClauses.push(`department = $${paramIndex++}`);
    params.push(department);
  }
  
  if (status) {
    whereClauses.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  
  let query = 'SELECT COUNT(*) as count FROM findings';
  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }
  
  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count, 10);
}
```


## Migration Files

### Migration 016: Create Findings Table

**File:** `migrations/016_create_findings_table.sql`

```sql
-- Migration 016: Create Findings Table for Risk Management
-- This adds the findings table to support structured failure tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create findings table
CREATE TABLE public.findings (
  -- IDs (dual-ID system)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sid VARCHAR(20) UNIQUE NOT NULL,
  
  -- Foreign Keys (all required, cascade delete)
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_sid VARCHAR(20) NOT NULL,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  question_sid VARCHAR(20) NOT NULL,
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_sid VARCHAR(20) NOT NULL,
  
  -- Finding Data (all nullable - consuming app enforces requirements)
  severity VARCHAR(100),
  department VARCHAR(100),
  observation TEXT,
  root_cause VARCHAR(100),
  evidence_urls TEXT[],
  assignment JSONB DEFAULT '[]',
  
  -- System Fields
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Create indexes for query performance
CREATE INDEX idx_findings_submission_sid ON public.findings(submission_sid);
CREATE INDEX idx_findings_question_sid ON public.findings(question_sid);
CREATE INDEX idx_findings_form_sid ON public.findings(form_sid);
CREATE INDEX idx_findings_severity ON public.findings(severity);
CREATE INDEX idx_findings_department ON public.findings(department);
CREATE INDEX idx_findings_created_at ON public.findings(created_at DESC);
CREATE INDEX idx_findings_assignment ON public.findings USING GIN (assignment);

-- Add SID counter for findings
INSERT INTO sid_counters (entity_type, counter) 
VALUES ('finding', 0) 
ON CONFLICT (entity_type) DO NOTHING;

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Migration 016 completed successfully';
    RAISE NOTICE 'Findings table created';
    RAISE NOTICE 'Indexes created: 7';
    RAISE NOTICE 'SID counter initialized';
END $$;
```


### Rollback Migration

**File:** `migrations/rollback_findings.sql`

```sql
-- Rollback Migration: Remove Findings Table
-- This removes the findings feature completely

-- Drop indexes first
DROP INDEX IF EXISTS idx_findings_assignment;
DROP INDEX IF EXISTS idx_findings_created_at;
DROP INDEX IF EXISTS idx_findings_department;
DROP INDEX IF EXISTS idx_findings_severity;
DROP INDEX IF EXISTS idx_findings_form_sid;
DROP INDEX IF EXISTS idx_findings_question_sid;
DROP INDEX IF EXISTS idx_findings_submission_sid;

-- Drop table (cascade will handle foreign keys)
DROP TABLE IF EXISTS findings CASCADE;

-- Remove SID counter
DELETE FROM sid_counters WHERE entity_type = 'finding';

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Findings rollback completed successfully';
    RAISE NOTICE 'Findings table dropped';
    RAISE NOTICE 'Indexes dropped';
    RAISE NOTICE 'SID counter removed';
END $$;
```


## Query Examples

### Basic Queries

```sql
-- Get all findings for a form
SELECT * FROM findings 
WHERE form_sid = 'FORM-001' 
ORDER BY created_at DESC;

-- Get all critical findings
SELECT * FROM findings 
WHERE severity = 'Critical' 
ORDER BY created_at DESC;

-- Get findings by department
SELECT * FROM findings 
WHERE department = 'Operations' 
ORDER BY created_at DESC;

-- Get findings for a specific submission
SELECT * FROM findings 
WHERE submission_sid = 'SUB-001';

-- Get findings for a specific question
SELECT * FROM findings 
WHERE question_sid = 'Q-123' 
ORDER BY created_at DESC;

-- Get findings by status
SELECT * FROM findings 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

### Advanced Queries

```sql
-- Get findings with assignment to specific user
SELECT * FROM findings 
WHERE assignment @> '[{"user_id": "user-uuid-here"}]'
ORDER BY created_at DESC;

-- Count findings by severity
SELECT severity, COUNT(*) as count 
FROM findings 
WHERE form_sid = 'FORM-001'
GROUP BY severity 
ORDER BY count DESC;

-- Count findings by department
SELECT department, COUNT(*) as count 
FROM findings 
WHERE form_sid = 'FORM-001'
GROUP BY department 
ORDER BY count DESC;

-- Get findings created in date range
SELECT * FROM findings 
WHERE created_at >= '2026-01-01' 
  AND created_at < '2026-02-01'
ORDER BY created_at DESC;

-- Find recurring issues (same question, multiple findings)
SELECT 
  question_sid,
  form_sid,
  COUNT(*) as occurrence_count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM findings
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY question_sid, form_sid
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;

-- Get findings with evidence
SELECT * FROM findings 
WHERE evidence_urls IS NOT NULL 
  AND array_length(evidence_urls, 1) > 0
ORDER BY created_at DESC;

-- Get unassigned findings
SELECT * FROM findings 
WHERE assignment = '[]'
ORDER BY created_at DESC;

-- Get open findings with critical severity
SELECT * FROM findings 
WHERE status = 'open' 
  AND severity = 'Critical'
ORDER BY created_at DESC;

-- Count findings by status
SELECT status, COUNT(*) as count 
FROM findings 
WHERE form_sid = 'FORM-001'
GROUP BY status 
ORDER BY count DESC;
```


### Reporting Queries

```sql
-- Summary statistics for a form
SELECT 
  COUNT(*) as total_findings,
  COUNT(DISTINCT question_sid) as questions_with_findings,
  COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN severity = 'Major' THEN 1 END) as major_count,
  COUNT(CASE WHEN severity = 'Minor' THEN 1 END) as minor_count,
  COUNT(CASE WHEN assignment != '[]' THEN 1 END) as assigned_count,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
FROM findings
WHERE form_sid = 'FORM-001';

-- Top 10 questions with most findings
SELECT 
  question_sid,
  COUNT(*) as finding_count,
  COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count
FROM findings
WHERE form_sid = 'FORM-001'
GROUP BY question_sid
ORDER BY finding_count DESC
LIMIT 10;

-- Findings trend over time (daily)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as finding_count,
  COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count
FROM findings
WHERE form_sid = 'FORM-001'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Department performance (findings by department)
SELECT 
  department,
  COUNT(*) as total_findings,
  COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_count,
  ROUND(AVG(CASE 
    WHEN severity = 'Critical' THEN 3
    WHEN severity = 'Major' THEN 2
    WHEN severity = 'Minor' THEN 1
    ELSE 0
  END), 2) as avg_severity_score
FROM findings
WHERE form_sid = 'FORM-001'
GROUP BY department
ORDER BY total_findings DESC;
```


## Usage Examples

### Creating a Finding

```javascript
import CheckOps from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Create a finding
const finding = await checkops.createFinding({
  submissionSid: 'SUB-001',
  questionSid: 'Q-123',
  formSid: 'FORM-001',
  severity: 'Major',
  department: 'Operations',
  observation: 'Portafilter not cleaned properly between extraction cycles',
  rootCause: 'Staff did not follow standard operating procedure',
  evidenceUrls: [
    'https://storage.example.com/evidence/photo1.jpg',
    'https://storage.example.com/evidence/photo2.jpg'
  ],
  assignment: [
    { user_id: 'user-uuid-1', user_name: 'John Doe' },
    { user_id: 'user-uuid-2', user_name: 'Jane Smith' }
  ],
  status: 'open',
  metadata: {
    location: 'Store #123',
    shift: 'Morning',
    inspector: 'Inspector Name'
  },
  createdBy: 'auditor@example.com'
});

console.log('Finding created:', finding.sid); // FND-001
```

### Querying Findings

```javascript
// Get finding by SID
const finding = await checkops.getFinding('FND-001');

// Get all findings for a form
const formFindings = await checkops.getFindingsByForm('FORM-001', {
  limit: 50,
  offset: 0
});

// Get findings for a submission
const submissionFindings = await checkops.getFindingsBySubmission('SUB-001');

// Get findings with filters
const criticalFindings = await checkops.getFindings({
  formSid: 'FORM-001',
  severity: 'Critical',
  department: 'Operations',
  status: 'open',
  createdAfter: '2026-01-01',
  limit: 100
});

// Count findings
const count = await checkops.countFindings({
  formSid: 'FORM-001',
  severity: 'Critical',
  status: 'open'
});
```

### Updating a Finding

```javascript
// Update finding fields
const updated = await checkops.updateFinding('FND-001', {
  rootCause: 'Updated root cause analysis after investigation',
  status: 'in_progress',
  assignment: [
    { user_id: 'user-uuid-3', user_name: 'Manager Name' }
  ],
  metadata: {
    ...finding.metadata,
    resolved_at: new Date().toISOString()
  }
});
```

### Deleting a Finding

```javascript
// Delete finding
const deleted = await checkops.deleteFinding('FND-001');
console.log('Deleted finding:', deleted.sid);
```


## Integration with Saiqa-Server

Saiqa-server handles business logic and validation on top of CheckOps data layer.

### Example: Saiqa-Server Validation

```javascript
// saiqa-server/lib/checkops-finding-validator.js

const ALLOWED_SEVERITIES = ['Minor', 'Major', 'Critical'];
const ALLOWED_DEPARTMENTS = ['Operations', 'Maintenance', 'Training', 'Equipment'];
const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

function validateFindingData(data) {
  const errors = [];
  
  // Required fields
  if (!data.observation || data.observation.trim() === '') {
    errors.push('Observation is required');
  }
  
  if (!data.severity) {
    errors.push('Severity is required');
  } else if (!ALLOWED_SEVERITIES.includes(data.severity)) {
    errors.push(`Severity must be one of: ${ALLOWED_SEVERITIES.join(', ')}`);
  }
  
  if (!data.department) {
    errors.push('Department is required');
  } else if (!ALLOWED_DEPARTMENTS.includes(data.department)) {
    errors.push(`Department must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}`);
  }
  
  // Status validation (optional field)
  if (data.status && !ALLOWED_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }
  
  // Assignment validation
  if (data.assignment && Array.isArray(data.assignment)) {
    data.assignment.forEach((assign, index) => {
      if (!assign.user_id) {
        errors.push(`Assignment[${index}]: user_id is required`);
      }
      if (!assign.user_name) {
        errors.push(`Assignment[${index}]: user_name is required`);
      }
    });
  }
  
  return errors;
}

module.exports = { validateFindingData };
```

### Example: Saiqa-Server API Endpoint

```javascript
// saiqa-server/steps/checkops-findings-create.step.js

const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFindingData } = require('../lib/checkops-finding-validator');
const { logActivity } = require('../utils/audit');

const config = {
  name: 'CreateFinding',
  type: 'api',
  path: '/api/checkops/findings',
  method: 'POST'
};

const handler = async (req, ctx) => {
  try {
    const checkops = getCheckOpsWrapper();
    const user = req.user; // From auth middleware
    
    // Validate input
    const errors = validateFindingData(req.body);
    if (errors.length > 0) {
      return {
        status: 400,
        body: { error: 'Validation failed', details: errors }
      };
    }
    
    // Create finding
    const finding = await checkops.createFinding({
      ...req.body,
      createdBy: user.email
    });
    
    // Audit log
    await logActivity({
      action: 'finding_created',
      entity_type: 'finding',
      entity_sid: finding.sid,
      user_id: user.id,
      ip_address: req.ip,
      details: { severity: finding.severity, department: finding.department }
    });
    
    return {
      status: 201,
      body: { success: true, data: finding }
    };
  } catch (error) {
    console.error('Finding creation failed:', error);
    return {
      status: 500,
      body: { error: 'Finding creation failed', message: error.message }
    };
  }
};

module.exports = { config, handler };
```


## Performance Considerations

### Indexes

The findings table includes indexes for common query patterns:

1. **Relationship Indexes**: Fast lookups by submission, question, or form
2. **Filter Indexes**: Efficient filtering by severity and department
3. **Time-based Index**: Optimized for date range queries
4. **JSONB Index (GIN)**: Fast queries on assignment field

### Query Optimization

```sql
-- GOOD: Uses indexes
SELECT * FROM findings WHERE form_sid = 'FORM-001' AND severity = 'Critical';

-- GOOD: Uses GIN index for JSONB
SELECT * FROM findings WHERE assignment @> '[{"user_id": "uuid"}]';

-- AVOID: Full table scan
SELECT * FROM findings WHERE observation LIKE '%keyword%';

-- BETTER: Use full-text search if needed
CREATE INDEX idx_findings_observation_fts ON findings USING GIN (to_tsvector('english', observation));
SELECT * FROM findings WHERE to_tsvector('english', observation) @@ to_tsquery('keyword');
```

### Pagination

Always use LIMIT and OFFSET for large result sets:

```javascript
// Good: Paginated query
const findings = await checkops.getFindings({
  formSid: 'FORM-001',
  limit: 50,
  offset: 0
});

// Avoid: Loading all findings at once
const allFindings = await checkops.getFindings({ formSid: 'FORM-001' }); // Could be thousands
```

### Cascade Delete Performance

When deleting forms with many findings:

```sql
-- This will cascade delete all submissions and findings
DELETE FROM forms WHERE sid = 'FORM-001';

-- For large datasets, consider batching:
DELETE FROM findings WHERE form_sid = 'FORM-001';
DELETE FROM submissions WHERE form_sid = 'FORM-001';
DELETE FROM forms WHERE sid = 'FORM-001';
```


## Best Practices

### 1. Use SIDs for User-Facing Operations

```javascript
// GOOD: User-facing API uses SIDs
const finding = await checkops.getFinding('FND-001');

// AVOID: Exposing UUIDs to users
const finding = await checkops.getFinding('550e8400-e29b-41d4-a716-446655440000');
```

### 2. Store URLs, Not Files

```javascript
// GOOD: Store URLs to evidence
evidenceUrls: [
  'https://s3.amazonaws.com/bucket/evidence/photo1.jpg',
  'https://storage.saiqa.com/uploads/evidence123.jpg'
]

// AVOID: Storing file data in database
evidenceUrls: ['data:image/jpeg;base64,/9j/4AAQSkZJRg...'] // Too large
```

### 3. Use Metadata for Extensibility

```javascript
// GOOD: Store custom fields in metadata
metadata: {
  location: 'Store #123',
  shift: 'Morning',
  inspector_id: 'INS-001',
  corrective_action: 'Retrain staff on SOP',
  due_date: '2026-02-01',
  status: 'open'
}
```

### 4. Validate in Application Layer

```javascript
// CheckOps: Just stores data
await checkops.createFinding({ severity: 'Invalid' }); // Allowed

// Saiqa-server: Enforces rules
if (!ALLOWED_SEVERITIES.includes(data.severity)) {
  throw new ValidationError('Invalid severity');
}
```

### 5. Query by Indexed Fields

```javascript
// GOOD: Uses indexes
await checkops.getFindings({ 
  formSid: 'FORM-001',
  severity: 'Critical',
  department: 'Operations'
});

// AVOID: Filtering in application
const all = await checkops.getFindings({ formSid: 'FORM-001' });
const filtered = all.filter(f => f.severity === 'Critical'); // Inefficient
```

### 6. Handle Cascade Deletes

```javascript
// Be aware: Deleting a form deletes all findings
await checkops.deleteForm('FORM-001'); 
// All submissions and findings for FORM-001 are also deleted

// If you need to preserve findings, export them first
const findings = await checkops.getFindingsByForm('FORM-001');
// Save to archive before deleting form
```


## Testing

### Unit Tests

```javascript
// tests/unit/models/Finding.test.js

import { Finding } from '../../../src/models/Finding.js';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/database.js';

describe('Finding Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  test('should create finding with all fields', async () => {
    const finding = await Finding.create({
      submissionSid: 'SUB-001',
      questionSid: 'Q-001',
      formSid: 'FORM-001',
      severity: 'Major',
      department: 'Operations',
      observation: 'Test observation',
      rootCause: 'Test root cause',
      evidenceUrls: ['https://example.com/photo.jpg'],
      assignment: [{ user_id: 'user-1', user_name: 'John Doe' }],
      status: 'open',
      metadata: { test: true },
      createdBy: 'test@example.com'
    });

    expect(finding.sid).toMatch(/^FND-\d+$/);
    expect(finding.severity).toBe('Major');
    expect(finding.department).toBe('Operations');
    expect(finding.assignment).toHaveLength(1);
  });

  test('should find finding by SID', async () => {
    const finding = await Finding.findBySid('FND-001');
    expect(finding).toBeDefined();
    expect(finding.sid).toBe('FND-001');
  });

  test('should update finding', async () => {
    const updated = await Finding.updateBySid('FND-001', {
      severity: 'Critical',
      status: 'in_progress',
      rootCause: 'Updated root cause'
    });

    expect(updated.severity).toBe('Critical');
    expect(updated.status).toBe('in_progress');
    expect(updated.rootCause).toBe('Updated root cause');
  });

  test('should delete finding', async () => {
    const deleted = await Finding.deleteBySid('FND-001');
    expect(deleted.sid).toBe('FND-001');

    await expect(Finding.findBySid('FND-001')).rejects.toThrow('not found');
  });
});
```

### Integration Tests

```javascript
// tests/integration/findings.test.js

import CheckOps from '../../../src/index.js';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/database.js';

describe('Findings Integration', () => {
  let checkops;

  beforeAll(async () => {
    await setupTestDatabase();
    checkops = new CheckOps(testConfig);
    await checkops.initialize();
  });

  afterAll(async () => {
    await checkops.close();
    await teardownTestDatabase();
  });

  test('complete finding workflow', async () => {
    // Create form
    const form = await checkops.createForm({
      title: 'Test Form',
      questions: [
        { questionText: 'Test Question', questionType: 'boolean', required: true }
      ]
    });

    // Create submission
    const submission = await checkops.createSubmission({
      formId: form.id,
      submissionData: { [form.questions[0].questionId]: 'No' }
    });

    // Create finding
    const finding = await checkops.createFinding({
      submissionSid: submission.sid,
      questionSid: form.questions[0].questionId,
      formSid: form.sid,
      severity: 'Major',
      department: 'Operations',
      observation: 'Failed check',
      status: 'open',
      assignment: [{ user_id: 'user-1', user_name: 'John' }]
    });

    expect(finding.sid).toMatch(/^FND-\d+$/);

    // Query findings
    const findings = await checkops.getFindingsByForm(form.sid);
    expect(findings).toHaveLength(1);
    expect(findings[0].sid).toBe(finding.sid);

    // Test cascade delete
    await checkops.deleteForm(form.sid);
    const findingsAfterDelete = await checkops.getFindingsByForm(form.sid);
    expect(findingsAfterDelete).toHaveLength(0);
  });
});
```


## Troubleshooting

### Common Issues

#### 1. Foreign Key Violation

**Error:**
```
ERROR: insert or update on table "findings" violates foreign key constraint
```

**Cause:** Referenced submission, question, or form does not exist.

**Solution:**
```javascript
// Verify parent records exist before creating finding
const submission = await checkops.getSubmission('SUB-001');
const question = await checkops.getQuestion('Q-001');
const form = await checkops.getForm('FORM-001');

// Then create finding
const finding = await checkops.createFinding({
  submissionSid: submission.sid,
  questionSid: question.sid,
  formSid: form.sid,
  // ...
});
```

#### 2. Invalid JSONB Format

**Error:**
```
ERROR: invalid input syntax for type json
```

**Cause:** Assignment or metadata is not valid JSON.

**Solution:**
```javascript
// GOOD: Valid JSON array
assignment: [{ user_id: 'user-1', user_name: 'John' }]

// BAD: Invalid format
assignment: "user-1" // Should be array of objects
```

#### 3. SID Counter Conflict

**Error:**
```
ERROR: duplicate key value violates unique constraint "findings_sid_unique"
```

**Cause:** SID counter out of sync (rare, usually in concurrent operations).

**Solution:**
```sql
-- Reset SID counter to max existing SID
UPDATE sid_counters 
SET counter = (SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'FND-(\\d+)') AS INTEGER)), 0) FROM findings)
WHERE entity_type = 'finding';
```

#### 4. Slow Queries

**Issue:** Queries taking too long.

**Solution:**
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE SELECT * FROM findings WHERE form_sid = 'FORM-001';

-- Rebuild indexes if needed
REINDEX TABLE findings;

-- Analyze table for query planner
ANALYZE findings;
```


## Future Enhancements

### Potential Features (Not in Current Scope)

1. **Batch Operations**
   ```javascript
   // Create multiple findings at once
   await checkops.bulkCreateFindings([...]);
   ```

2. **Finding Templates**
   ```javascript
   // Pre-defined finding templates
   await checkops.createFindingFromTemplate('safety-violation', { ... });
   ```

3. **Workflow States**
   ```javascript
   // Built-in state machine
   await checkops.transitionFinding('FND-001', 'open' -> 'in_progress' -> 'resolved');
   ```

4. **Notifications**
   ```javascript
   // Event hooks
   checkops.on('finding:created', async (finding) => {
     // Send notification
   });
   ```

5. **Full-Text Search**
   ```sql
   -- Add full-text search on observation and root_cause
   CREATE INDEX idx_findings_fts ON findings 
   USING GIN (to_tsvector('english', observation || ' ' || COALESCE(root_cause, '')));
   ```

6. **Audit Trail**
   ```javascript
   // Track all changes to findings
   CREATE TABLE finding_history (
     id UUID PRIMARY KEY,
     finding_sid VARCHAR(20),
     changed_at TIMESTAMP,
     changed_by VARCHAR(100),
     changes JSONB
   );
   ```

**Note:** These features should be implemented in the consuming application (Saiqa-server) rather than in CheckOps core.


## Summary

### What CheckOps Provides

- ✅ Database schema for findings table
- ✅ Dual-ID system (UUID + SID)
- ✅ Foreign key relationships with cascade delete
- ✅ Indexes for query performance
- ✅ CRUD operations via Finding model
- ✅ Basic filtering and pagination
- ✅ JSONB support for assignment and metadata

### What Consuming Applications are required to handle

- Field validation (required fields, allowed values)
- Business logic (workflow states, notifications)
- Multi-tenancy and access control
- UI/UX for creating and managing findings
- Analytics and reporting dashboards
- Integration with external systems

### Key Takeaways

1. **Data Layer Only**: CheckOps stores and retrieves data, nothing more
2. **Flexible Schema**: All data fields are nullable, consuming app enforces rules
3. **Query Optimized**: Indexes support efficient filtering and reporting
4. **Extensible**: JSONB fields allow custom data without schema changes
5. **Consistent Pattern**: Follows same dual-ID pattern as other CheckOps entities

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Draft - Ready for Implementation

