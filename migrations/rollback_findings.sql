-- Rollback Migration: Remove Findings Table
-- This removes the findings feature completely
-- WARNING: This will delete all findings data permanently

-- Drop indexes first
DROP INDEX IF EXISTS idx_findings_assignment;
DROP INDEX IF EXISTS idx_findings_created_at;
DROP INDEX IF EXISTS idx_findings_status;
DROP INDEX IF EXISTS idx_findings_department;
DROP INDEX IF EXISTS idx_findings_severity;
DROP INDEX IF EXISTS idx_findings_form_sid;
DROP INDEX IF EXISTS idx_findings_question_sid;
DROP INDEX IF EXISTS idx_findings_submission_sid;

-- Drop table (cascade will handle foreign keys)
DROP TABLE IF EXISTS public.findings CASCADE;

-- Remove SID counter
DELETE FROM sid_counters WHERE entity_type = 'finding';

-- Verification
DO $$
DECLARE
    findings_table_exists BOOLEAN;
    counter_exists BOOLEAN;
BEGIN
    -- Check if table still exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name = 'findings'
    ) INTO findings_table_exists;
    
    -- Check if counter still exists
    SELECT EXISTS (
        SELECT FROM sid_counters
        WHERE entity_type = 'finding'
    ) INTO counter_exists;
    
    RAISE NOTICE 'Findings rollback completed successfully';
    RAISE NOTICE '  Findings table dropped: %', NOT findings_table_exists;
    RAISE NOTICE '  SID counter removed: %', NOT counter_exists;
    
    IF findings_table_exists THEN
        RAISE EXCEPTION 'Rollback failed: findings table still exists';
    END IF;
    
    IF counter_exists THEN
        RAISE EXCEPTION 'Rollback failed: SID counter still exists';
    END IF;
END $$;
