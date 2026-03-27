-- Migration 009: Cleanup and optimize after UUID migration
-- This is Phase 4 (final) of the v4.0.0 dual-ID system migration
--
-- What this does:
-- 1. Drop temporary mapping table
-- 2. Drop id_counters table (no longer needed)
-- 3. Drop old form_sid column from submissions (keep for reference only if needed)
-- 4. Optimize indexes
-- 5. Update table statistics
-- 6. Vacuum tables

-- ============================================================================
-- DROP TEMPORARY TABLES
-- ============================================================================

-- Drop the temporary mapping table
DROP TABLE IF EXISTS id_mapping;

-- Drop the id_counters table (no longer needed with UUID)
DROP TABLE IF EXISTS id_counters;

-- Drop the get_next_id function (no longer needed)
DROP FUNCTION IF EXISTS get_next_id(VARCHAR);

-- ============================================================================
-- OPTIONAL: Drop form_sid column from submissions
-- ============================================================================
-- Uncomment this if you don't need to keep the old SID reference
-- This saves storage space but removes the ability to see old form SIDs

-- ALTER TABLE submissions DROP COLUMN IF EXISTS form_sid;

-- If keeping form_sid, at least remove the index to save space
DROP INDEX IF EXISTS idx_submissions_form_sid;

-- ============================================================================
-- OPTIMIZE INDEXES
-- ============================================================================

-- Reindex all tables for optimal performance
REINDEX TABLE forms;
REINDEX TABLE question_bank;
REINDEX TABLE submissions;

-- Optionally: Reindex question_option_history if it exists
DO $
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_option_history') THEN
        EXECUTE 'REINDEX TABLE question_option_history';
        RAISE NOTICE 'Reindexed question_option_history';
    END IF;
END $;

-- ============================================================================
-- UPDATE STATISTICS
-- ============================================================================

-- Analyze all tables to update query planner statistics
ANALYZE forms;
ANALYZE question_bank;
ANALYZE submissions;

DO $
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_option_history') THEN
        EXECUTE 'ANALYZE question_option_history';
    END IF;
END $;

-- ============================================================================
-- VACUUM TABLES
-- ============================================================================

-- Vacuum to reclaim storage and optimize performance
VACUUM ANALYZE forms;
VACUUM ANALYZE question_bank;
VACUUM ANALYZE submissions;

DO $
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_option_history') THEN
        EXECUTE 'VACUUM ANALYZE question_option_history';
    END IF;
END $;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $
DECLARE
    forms_count INTEGER;
    questions_count INTEGER;
    submissions_count INTEGER;
    forms_size TEXT;
    questions_size TEXT;
    submissions_size TEXT;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO forms_count FROM forms;
    SELECT COUNT(*) INTO questions_count FROM question_bank;
    SELECT COUNT(*) INTO submissions_count FROM submissions;
    
    -- Get table sizes
    SELECT pg_size_pretty(pg_total_relation_size('forms')) INTO forms_size;
    SELECT pg_size_pretty(pg_total_relation_size('question_bank')) INTO questions_size;
    SELECT pg_size_pretty(pg_total_relation_size('submissions')) INTO submissions_size;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration 009 (Final) completed successfully';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  Forms: % records, %', forms_count, forms_size;
    RAISE NOTICE '  Questions: % records, %', questions_count, questions_size;
    RAISE NOTICE '  Submissions: % records, %', submissions_count, submissions_size;
    RAISE NOTICE '';
    RAISE NOTICE 'Schema Changes:';
    RAISE NOTICE '  ✓ UUID primary keys active';
    RAISE NOTICE '  ✓ SID columns for human-readable IDs';
    RAISE NOTICE '  ✓ Foreign keys migrated to UUID';
    RAISE NOTICE '  ✓ Old counter system removed';
    RAISE NOTICE '  ✓ Indexes optimized';
    RAISE NOTICE '  ✓ Statistics updated';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Update CheckOps package to v4.0.0';
    RAISE NOTICE '  2. Test application thoroughly';
    RAISE NOTICE '  3. Monitor performance';
    RAISE NOTICE '============================================';
END $;

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR DUAL-ID LOOKUPS
-- ============================================================================

-- Function to get UUID from SID
CREATE OR REPLACE FUNCTION get_uuid_from_sid(
    table_name TEXT,
    sid_value VARCHAR(50)
)
RETURNS UUID AS $
DECLARE
    result UUID;
BEGIN
    EXECUTE format('SELECT id FROM %I WHERE sid = $1', table_name)
    INTO result
    USING sid_value;
    
    RETURN result;
END;
$ LANGUAGE plpgsql STABLE;

-- Function to get SID from UUID
CREATE OR REPLACE FUNCTION get_sid_from_uuid(
    table_name TEXT,
    uuid_value UUID
)
RETURNS VARCHAR(50) AS $
DECLARE
    result VARCHAR(50);
BEGIN
    EXECUTE format('SELECT sid FROM %I WHERE id = $1', table_name)
    INTO result
    USING uuid_value;
    
    RETURN result;
END;
$ LANGUAGE plpgsql STABLE;

-- Example usage:
-- SELECT get_uuid_from_sid('forms', 'FORM-001');
-- SELECT get_sid_from_uuid('forms', '550e8400-e29b-41d4-a716-446655440000');

RAISE NOTICE 'Helper functions created: get_uuid_from_sid(), get_sid_from_uuid()';
