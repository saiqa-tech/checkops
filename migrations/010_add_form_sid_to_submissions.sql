-- Migration 010: Populate form_sid in submissions table
-- This is part of v4.0.0 dual-ID system
--
-- What this does:
-- 1. Updates form_sid column with actual SID values from forms table
-- 2. The form_sid column already exists (renamed from old form_id in migration 008)
-- 3. But it contains old VARCHAR IDs, we need to update with new SIDs

-- Update form_sid with actual SID values from forms table
UPDATE submissions s
SET form_sid = f.sid
FROM forms f
WHERE s.form_id = f.id;

-- Verification
DO $
DECLARE
    total_submissions INTEGER;
    populated_submissions INTEGER;
    null_submissions INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_submissions FROM submissions;
    SELECT COUNT(*) INTO populated_submissions FROM submissions WHERE form_sid IS NOT NULL;
    SELECT COUNT(*) INTO null_submissions FROM submissions WHERE form_sid IS NULL;
    
    RAISE NOTICE 'Migration 010 completed';
    RAISE NOTICE 'Total submissions: %', total_submissions;
    RAISE NOTICE 'Submissions with form_sid: %', populated_submissions;
    RAISE NOTICE 'Submissions with NULL form_sid: %', null_submissions;
    
    IF null_submissions > 0 THEN
        RAISE WARNING '% submissions have NULL form_sid - these may be orphaned records', null_submissions;
    END IF;
END $;
