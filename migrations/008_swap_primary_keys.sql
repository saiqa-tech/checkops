-- Migration 008: Swap primary keys from VARCHAR to UUID
-- This is Phase 3 of the v4.0.0 dual-ID system migration
--
-- What this does:
-- 1. Drop old foreign key constraints
-- 2. Drop old primary key constraints
-- 3. Rename columns: id -> sid, id_new -> id
-- 4. Set UUID as new primary key
-- 5. Create new foreign key constraints
-- 6. Drop old foreign key columns

-- ============================================================================
-- SUBMISSIONS TABLE: Drop old foreign key constraint
-- ============================================================================

ALTER TABLE submissions 
DROP CONSTRAINT IF EXISTS fk_form;

-- ============================================================================
-- FORMS TABLE: Swap primary key
-- ============================================================================

-- Drop old primary key
ALTER TABLE forms 
DROP CONSTRAINT forms_pkey;

-- Rename columns
ALTER TABLE forms 
RENAME COLUMN id TO sid;

ALTER TABLE forms 
RENAME COLUMN id_new TO id;

-- Set new primary key
ALTER TABLE forms 
ADD PRIMARY KEY (id);

-- Ensure sid is unique and not null
ALTER TABLE forms 
ADD CONSTRAINT forms_sid_unique UNIQUE (sid);

ALTER TABLE forms 
ALTER COLUMN sid SET NOT NULL;

-- ============================================================================
-- QUESTION_BANK TABLE: Swap primary key
-- ============================================================================

-- Drop old primary key
ALTER TABLE question_bank 
DROP CONSTRAINT question_bank_pkey;

-- Rename columns
ALTER TABLE question_bank 
RENAME COLUMN id TO sid;

ALTER TABLE question_bank 
RENAME COLUMN id_new TO id;

-- Set new primary key
ALTER TABLE question_bank 
ADD PRIMARY KEY (id);

-- Ensure sid is unique and not null
ALTER TABLE question_bank 
ADD CONSTRAINT question_bank_sid_unique UNIQUE (sid);

ALTER TABLE question_bank 
ALTER COLUMN sid SET NOT NULL;

-- ============================================================================
-- SUBMISSIONS TABLE: Swap primary key and foreign keys
-- ============================================================================

-- Drop old primary key
ALTER TABLE submissions 
DROP CONSTRAINT submissions_pkey;

-- Rename columns
ALTER TABLE submissions 
RENAME COLUMN id TO sid;

ALTER TABLE submissions 
RENAME COLUMN id_new TO id;

-- Keep old form_id as form_sid (VARCHAR - for display)
-- This preserves the SID value
ALTER TABLE submissions 
RENAME COLUMN form_id TO form_sid;

-- Rename form_id_new to form_id (UUID - foreign key)
ALTER TABLE submissions 
RENAME COLUMN form_id_new TO form_id;

-- Set new primary key
ALTER TABLE submissions 
ADD PRIMARY KEY (id);

-- Ensure sid is unique and not null
ALTER TABLE submissions 
ADD CONSTRAINT submissions_sid_unique UNIQUE (sid);

ALTER TABLE submissions 
ALTER COLUMN sid SET NOT NULL;

-- Add new foreign key constraint (UUID -> UUID)
ALTER TABLE submissions 
ADD CONSTRAINT fk_form 
FOREIGN KEY (form_id) 
REFERENCES forms(id) 
ON DELETE CASCADE;

-- ============================================================================
-- UPDATE INDEXES
-- ============================================================================

-- Drop old indexes on sid columns (they were on old 'id')
DROP INDEX IF EXISTS idx_forms_id_new;
DROP INDEX IF EXISTS idx_question_bank_id_new;
DROP INDEX IF EXISTS idx_submissions_id_new;
DROP INDEX IF EXISTS idx_submissions_form_id_new;

-- Create new indexes on sid columns for lookups
CREATE INDEX idx_forms_sid ON forms(sid);
CREATE INDEX idx_question_bank_sid ON question_bank(sid);
CREATE INDEX idx_submissions_sid ON submissions(sid);
CREATE INDEX idx_submissions_form_sid ON submissions(form_sid);

-- Recreate index on form_id (now UUID)
CREATE INDEX idx_submissions_form_id ON submissions(form_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $
DECLARE
    forms_count INTEGER;
    questions_count INTEGER;
    submissions_count INTEGER;
    fk_violations INTEGER;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO forms_count FROM forms;
    SELECT COUNT(*) INTO questions_count FROM question_bank;
    SELECT COUNT(*) INTO submissions_count FROM submissions;
    
    -- Check for foreign key violations
    SELECT COUNT(*) INTO fk_violations
    FROM submissions s
    LEFT JOIN forms f ON s.form_id = f.id
    WHERE f.id IS NULL;
    
    RAISE NOTICE 'Migration 008 verification:';
    RAISE NOTICE '  Forms: %', forms_count;
    RAISE NOTICE '  Questions: %', questions_count;
    RAISE NOTICE '  Submissions: %', submissions_count;
    RAISE NOTICE '  FK violations: %', fk_violations;
    
    IF fk_violations > 0 THEN
        RAISE EXCEPTION 'Migration failed: % foreign key violations detected', fk_violations;
    END IF;
    
    -- Verify all tables have both id (UUID) and sid (VARCHAR)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Migration failed: forms.id is not UUID';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'sid' AND data_type = 'character varying'
    ) THEN
        RAISE EXCEPTION 'Migration failed: forms.sid is not VARCHAR';
    END IF;
    
    RAISE NOTICE 'Migration 008 completed successfully';
END $;
