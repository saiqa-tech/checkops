# Database Schema Documentation

This document describes the database schema for CheckOps.

## Overview

CheckOps uses PostgreSQL 18 with JSONB support for flexible, high-performance data storage. The schema consists of four main tables:

1. **forms** - Stores form definitions
2. **question_bank** - Centralized repository of reusable questions
3. **submissions** - Stores form submission data
4. **id_counters** - Manages human-readable ID generation

## Tables

### forms

Stores form definitions with their questions and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY | Human-readable ID (FORM-001, FORM-002, etc.) |
| title | VARCHAR(255) | NOT NULL | Form title |
| description | TEXT | | Form description |
| questions | JSONB | NOT NULL, DEFAULT '[]' | Array of question objects |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| is_active | BOOLEAN | DEFAULT true | Whether form accepts submissions |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_forms_is_active` on `is_active`
- `idx_forms_created_at` on `created_at DESC`
- `idx_forms_questions` (GIN) on `questions`

**Triggers:**
- `update_forms_updated_at` - Automatically updates `updated_at` on row updates

**Example Row:**

```json
{
  "id": "FORM-001",
  "title": "Customer Feedback",
  "description": "Share your experience",
  "questions": [
    {
      "questionId": "Q-001",
      "questionText": "Name",
      "questionType": "text",
      "required": true
    }
  ],
  "metadata": {
    "category": "feedback",
    "version": 1
  },
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### question_bank

Centralized repository of reusable questions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY | Human-readable ID (Q-001, Q-002, etc.) |
| question_text | TEXT | NOT NULL | Question text |
| question_type | VARCHAR(50) | NOT NULL | Question type (text, email, select, etc.) |
| options | JSONB | | Options for select/radio/checkbox questions |
| validation_rules | JSONB | | Validation rules (min, max, pattern, etc.) |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| is_active | BOOLEAN | DEFAULT true | Whether question is available for use |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Constraints:**
- `valid_question_type` CHECK - Ensures question_type is one of the valid types

**Indexes:**
- `idx_question_bank_question_type` on `question_type`
- `idx_question_bank_is_active` on `is_active`
- `idx_question_bank_created_at` on `created_at DESC`
- `idx_question_bank_options` (GIN) on `options`
- `idx_question_bank_validation_rules` (GIN) on `validation_rules`

**Triggers:**
- `update_question_bank_updated_at` - Automatically updates `updated_at` on row updates

**Valid Question Types:**
- text
- textarea
- number
- email
- phone
- date
- time
- datetime
- select
- multiselect
- radio
- checkbox
- boolean
- file
- rating

**Example Row:**

```json
{
  "id": "Q-001",
  "question_text": "What is your email address?",
  "question_type": "email",
  "options": null,
  "validation_rules": {
    "required": true,
    "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  },
  "metadata": {
    "category": "contact",
    "helpText": "We'll never share your email"
  },
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### submissions

Stores form submission data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY | Human-readable ID (SUB-001, SUB-002, etc.) |
| form_id | VARCHAR(50) | NOT NULL, FOREIGN KEY | Reference to forms.id |
| submission_data | JSONB | NOT NULL | Submitted data as key-value pairs |
| metadata | JSONB | DEFAULT '{}' | Additional metadata (IP, user agent, etc.) |
| submitted_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Submission timestamp |

**Foreign Keys:**
- `fk_form` - References `forms(id)` with ON DELETE CASCADE

**Indexes:**
- `idx_submissions_form_id` on `form_id`
- `idx_submissions_submitted_at` on `submitted_at DESC`
- `idx_submissions_data` (GIN) on `submission_data`
- `idx_submissions_metadata` (GIN) on `metadata`

**Example Row:**

```json
{
  "id": "SUB-001",
  "form_id": "FORM-001",
  "submission_data": {
    "Name": "John Doe",
    "Email": "john@example.com",
    "Rating": 5
  },
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "submittedBy": "user-123"
  },
  "submitted_at": "2024-01-01T12:00:00Z"
}
```

### id_counters

Manages counter-based human-readable ID generation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| entity_type | VARCHAR(50) | PRIMARY KEY | Entity type (form, question, submission) |
| current_value | INTEGER | NOT NULL, DEFAULT 0 | Current counter value |

**Functions:**
- `get_next_id(entity VARCHAR)` - Returns next ID for entity type and increments counter

**Example Rows:**

```json
[
  { "entity_type": "form", "current_value": 42 },
  { "entity_type": "question", "current_value": 156 },
  { "entity_type": "submission", "current_value": 1024 }
]
```

## Relationships

```
forms (1) ──── (N) submissions
   │
   │ (references)
   ▼
question_bank
```

- A **form** can have zero or many **submissions** (1:N)
- A **form** can reference zero or many **questions** from the question bank (N:M implicit through JSONB)
- A **submission** belongs to exactly one **form** (N:1)
- **Cascade delete**: Deleting a form deletes all its submissions

## JSONB Structures

### Form Questions (forms.questions)

```json
[
  {
    "questionId": "Q-001",
    "questionText": "Override text (optional)",
    "questionType": "text",
    "required": true,
    "options": null,
    "validationRules": {
      "minLength": 3,
      "maxLength": 100
    },
    "metadata": {
      "placeholder": "Enter your answer",
      "helpText": "Help text here"
    }
  }
]
```

### Question Options (question_bank.options)

**Simple options:**
```json
["Option 1", "Option 2", "Option 3"]
```

**Complex options:**
```json
[
  { "value": "opt1", "label": "Option 1", "description": "Details" },
  { "value": "opt2", "label": "Option 2", "description": "Details" }
]
```

### Validation Rules (question_bank.validation_rules)

```json
{
  "min": 0,
  "max": 100,
  "minLength": 5,
  "maxLength": 500,
  "pattern": "^[A-Za-z0-9]+$",
  "required": true
}
```

### Submission Data (submissions.submission_data)

```json
{
  "questionId1": "answer1",
  "questionId2": ["answer2a", "answer2b"],
  "questionId3": 42
}
```

## Indexing Strategy

### GIN Indexes for JSONB

GIN (Generalized Inverted Index) indexes are used for efficient JSONB querying:

1. **forms.questions** - Fast question searches within forms
2. **question_bank.options** - Quick option lookups
3. **question_bank.validation_rules** - Efficient validation rule searches
4. **submissions.submission_data** - Fast submission data queries
5. **submissions.metadata** - Quick metadata filtering

### B-tree Indexes

Standard B-tree indexes for:
- Primary keys (id columns)
- Foreign keys (form_id)
- Boolean filters (is_active)
- Timestamp ordering (created_at, submitted_at)

## Query Examples

### Find all active forms

```sql
SELECT * FROM forms
WHERE is_active = true
ORDER BY created_at DESC;
```

### Get submissions for a form

```sql
SELECT * FROM submissions
WHERE form_id = 'FORM-001'
ORDER BY submitted_at DESC
LIMIT 100;
```

### Search questions by type

```sql
SELECT * FROM question_bank
WHERE question_type = 'email'
  AND is_active = true;
```

### Query JSONB data

```sql
-- Find forms containing a specific question
SELECT * FROM forms
WHERE questions @> '[{"questionId": "Q-001"}]';

-- Find submissions with specific answer
SELECT * FROM submissions
WHERE submission_data @> '{"Rating": 5}';

-- Extract specific field from JSONB
SELECT id, submission_data->>'Name' as name
FROM submissions
WHERE form_id = 'FORM-001';
```

### Get next ID

```sql
SELECT get_next_id('form');  -- Returns next form ID number
```

## Performance Considerations

1. **JSONB vs JSON**: JSONB is used for faster processing and indexing
2. **GIN Indexes**: Enable efficient JSONB queries but increase write time
3. **Connection Pooling**: Configured in application layer (default max: 20)
4. **Cascade Deletes**: Deleting forms automatically removes submissions
5. **Timestamps**: Automatically managed by triggers

## Migration Strategy

Migrations are run sequentially:

1. `001_create_forms_table.sql` - Creates forms table
2. `002_create_question_bank_table.sql` - Creates question bank
3. `003_create_submissions_table.sql` - Creates submissions table
4. `004_create_id_counters.sql` - Creates ID counter system

Run migrations with:

```bash
npm run migrate
```

## Backup and Restore

### Backup

```bash
pg_dump -h localhost -U postgres -d checkops > backup.sql
```

### Restore

```bash
psql -h localhost -U postgres -d checkops < backup.sql
```

## Security

- All queries use parameterized statements (no SQL injection)
- Input sanitization at application layer
- HTTPS recommended for production
- Row-level security can be added for multi-tenancy
- Regular backups recommended

## Scalability

For large-scale deployments:

1. **Partitioning**: Partition submissions table by date
2. **Read Replicas**: Use PostgreSQL replication for read-heavy loads
3. **Archiving**: Move old submissions to archive tables
4. **Connection Pooling**: Use PgBouncer for connection management
5. **Caching**: Cache frequently accessed forms in Redis
