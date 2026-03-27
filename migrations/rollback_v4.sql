-- Rollback Script for v4.0.0 Migration
-- 
-- WARNING: This script will revert the dual-ID system back to v3.x schema
-- Only use this if the v4.0.0 migration has failed or needs to be reverted
-- 
-- PREREQUISITES:
-- 1. You must have a database backup before running this
-- 2. All migrations 006-009 must have been run
-- 3. Application must be stopped during rollback
--
-- WHAT THIS DOES:
-- 1. Recreates id_counters table
-- 2. Swaps columns back: id (UUID) -> id_temp, sid -> id
-- 3. Restores VARCHAR primary keys
-- 4. Restores old foreign key relationships
-- 5. Drops UUID columns
-- 6. Restores original indexes

-- ============================================================================
-- STEP 1: Recreate id_counters table
-- ============================================================================

CREATE TABLE IF NOT EXISTS id_counters (
    entity_type VARCHAR(50) PRIMARY KEY,
    current_value INTEGER NOT NULL DEFAULT 0
);

-- Calculate current max values from SIDs
DO $
DECLARE
    max_form_num INTEGER;
    max_question_num INTEGER;
    max_submission_num INTEGER;
BEGIN
    -- Extract numeric part from FORM-XXX
    SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'FORM-(.*)') AS INTEGER)), 0)
    INTO max_form_num
    FROM forms
    WHERE sid ~ '^FORM-[0-9]+$';
    
    -- Extract numeric part from Q-XXX
    SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'Q-(.*)') AS INTEGER)), 0)
    INTO max_question_num
    FROM question_bank
    WHERE sid ~ '^Q-[0-9]+$';
    
    -- Extract numeric part from SUB-XXX
    SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'SUB-(.*)') AS INTEGER)), 0)
    INTO max_submission_num
    FROM submissions
    WHERE sid ~ '^SUB-[0-9]+$';
    
    -- Insert counters
    INSERT INTO id_counters (entity_type, current_value) VALUES
        ('form', max_form_num),
        ('question', max_question_num),
        ('submission', max_submission_num)
    ON CONFLICT (entity_type) DO UPDATE
    SET current_value = EXCLUDED.current_value;
    
    RAISE NOTICE 'Recreated id_counters: form=%, question=%, submission=%', 
        max_form_num, max_question_num, max_submission_num;
END $;

-- Recreate get_next_id function
CREATE OR REPLACE FUNCTION get_next_id(entity VARCHAR(50))
RETURNS INTEGER AS $
DECLARE
    next_val INTEGER;
BEGIN
    UPDATE id_counters 
    SET current_value = current_value + 1 
    WHERE entity_type = entity
    RETURNING current_value INTO next_val;
    
    RETURN next_val;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Drop foreign key constraints
-- ============================================================================

ALTER TABLE submissions 
DROP CONSTRAINT IF EXISTS fk_form;

-- ============================================================================
-- STEP 3: SUBMISSIONS TABLE - Revert to VARCHAR primary key
-- ============================================================================

-- Drop UUID primary key
ALTER TABLE submissions 
DROP CONSTRAINT IF EXISTS submissions_pkey;

-- Drop sid unique constraint
ALTER TABLE submissions 
DROP CONSTRAINT IF EXISTS submissions_sid_unique;

-- Rename columns back
ALTER TABLE submissions 
RENAME COLUMN id TO id_uuid;

ALTER TABLE submissions 
RENAME COLUMN sid TO id;

ALTER TABLE submissions 
RENAME COLUMN form_id TO form_id_uuid;

ALTER TABLE submissions 
RENAME COLUMN form_sid TO form_id;

-- Set VARCHAR as primary key
ALTER TABLE submissions 
ADD PRIMARY KEY (id);

-- ============================================================================
-- STEP 4: FORMS TABLE - Revert to VARCHAR primary key
-- ============================================================================

-- Drop UUID primary key
ALTER TABLE forms 
DROP CONSTRAINT IF EXISTS forms_pkey;

-- Drop sid unique constraint
ALTER TABLE forms 
DROP CONSTRAINT IF EXISTS forms_sid_unique;

-- Rename columns back
ALTER TABLE forms 
RENAME COLUMN id TO id_uuid;

ALTER TABLE forms 
RENAME COLUMN sid TO id;

-- Set VARCHAR as primary key
ALTER TABLE forms 
ADD PRIMARY KEY (id);

-- ============================================================================
-- STEP 5: QUESTION_BANK TABLE - Revert to VARCHAR primary key
-- ============================================================================

-- Drop UUID primary key
ALTER TABLE question_bank 
DROP CONSTRAINT IF EXISTS question_bank_pkey;

-- Drop sid unique constraint
ALTER TABLE question_bank 
DROP CONSTRAINT IF EXISTS question_bank_sid_unique;

-- Rename columns back
ALTER TABLE question_bank 
RENAME COLUMN id TO id_uuid;

ALTER TABLE question_bank 
RENAME COLUMN sid TO id;

-- Set VARCHAR as primary key
ALTER TABLE question_bank 
ADD PRIMARY KEY (id);

-- ============================================================================
-- STEP 6: Restore foreign key constraints
-- ============================================================================

ALTER TABLE submissions 
ADD CONSTRAINT fk_form 
FOREIGN KEY (form_id) 
REFERENCES forms(id) 
ON DELETE CASCADE;

-- ============================================================================
-- STEP 7: Drop UUID columns
-- ============================================================================

ALTER TABLE forms DROP COLUMN IF EXISTS id_uuid;
ALTER TABLE question_bank DROP COLUMN IF EXISTS id_uuid;
ALTER TABLE submissions DROP COLUMN IF EXISTS id_uuid;
ALTER TABLE submissions DROP COLUMN IF EXISTS form_id_uuid;

-- ============================================================================
-- STEP 8: Recreate original indexes
-- ============================================================================

-- Drop v4 indexes
DROP INDEX IF EXISTS idx_forms_sid;
DROP INDEX IF EXISTS idx_question_bank_sid;
DROP INDEX IF EXISTS idx_submissions_sid;
DROP INDEX IF EXISTS idx_submissions_form_id;

-- Recreate original indexes (they should already exist on id columns)
CREATE INDEX IF NOT EXISTS idx_forms_is_active ON forms(is_active);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forms_questions ON forms USING GIN (questions);

CREATE INDEX IF NOT EXISTS idx_question_bank_question_type ON question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_is_active ON question_bank(is_active);
CREATE INDEX IF NOT EXISTS idx_question_bank_created_at ON question_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_options ON question_bank USING GIN (options);
CREATE INDEX IF NOT EXISTS idx_question_bank_validation_rules ON question_bank USING GIN (validation_rules);

CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_data ON submissions USING GIN (submission_data);
CREATE INDEX IF NOT EXISTS idx_submissions_metadata ON submissions USING GIN (metadata);

-- ============================================================================
-- STEP 9: Drop helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS get_uuid_from_sid(TEXT, VARCHAR);
DROP FUNCTION IF EXISTS get_sid_from_uuid(TEXT, UUID);

-- ============================================================================
-- STEP 10: Optimize and verify
-- ============================================================================

REINDEX TABLE forms;
REINDEX TABLE question_bank;
REINDEX TABLE submissions;

ANALYZE forms;
ANALYZE question_bank;
ANALYZE submissions;

VACUUM ANALYZE forms;
VACUUM ANALYZE question_bank;
VACUUM ANALYZE submissions;

-- ============================================================================
-- FINAL VERIFICATION
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
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Rollback completed';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  Forms: %', forms_count;
    RAISE NOTICE '  Questions: %', questions_count;
    RAISE NOTICE '  Submissions: %', submissions_count;
    RAISE NOTICE '  FK violations: %', fk_violations;
    RAISE NOTICE '';
    
    IF fk_violations > 0 THEN
        RAISE WARNING 'WARNING: % foreign key violations detected!', fk_violations;
        RAISE WARNING 'You may need to restore from backup';
    ELSE
        RAISE NOTICE 'Schema Changes:';
        RAISE NOTICE '  ✓ VARCHAR primary keys restored';
        RAISE NOTICE '  ✓ UUID columns removed';
        RAISE NOTICE '  ✓ Foreign keys restored';
        RAISE NOTICE '  ✓ id_counters table restored';
        RAISE NOTICE '  ✓ Original indexes restored';
        RAISE NOTICE '';
        RAISE NOTICE 'Next Steps:';
        RAISE NOTICE '  1. Downgrade CheckOps package to v3.x';
        RAISE NOTICE '  2. Test application thoroughly';
        RAISE NOTICE '  3. Investigate why v4.0.0 migration failed';
    END IF;
    
    RAISE NOTICE '============================================';
END $;
