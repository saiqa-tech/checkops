-- Migration 007: Migrate foreign key relationships to UUID
-- This is Phase 2 of the v4.0.0 dual-ID system migration
--
-- What this does:
-- 1. Adds new UUID foreign key columns
-- 2. Populates them with corresponding UUIDs from mapping table
-- 3. Verifies all relationships are intact
-- 4. Creates new foreign key constraints

-- Add new UUID foreign key column to submissions table
ALTER TABLE submissions 
ADD COLUMN form_id_new UUID;

-- Populate form_id_new using the mapping table
UPDATE submissions s
SET form_id_new = m.new_id
FROM id_mapping m
WHERE m.entity_type = 'form' 
  AND m.old_id = s.form_id;

-- Verify all submissions have a valid form_id_new
DO $
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM submissions
    WHERE form_id_new IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % submissions have no matching form_id_new', orphaned_count;
    END IF;
    
    RAISE NOTICE 'All % submissions have valid form_id_new', (SELECT COUNT(*) FROM submissions);
END $;

-- Make form_id_new NOT NULL now that it's populated
ALTER TABLE submissions 
ALTER COLUMN form_id_new SET NOT NULL;

-- Create index on new foreign key column (before adding constraint for performance)
CREATE INDEX idx_submissions_form_id_new ON submissions(form_id_new);

-- Note: We'll add the actual foreign key constraint in the next migration
-- after we've swapped the primary keys

-- Verification queries
-- Check that all foreign key relationships are preserved
DO $
DECLARE
    forms_count INTEGER;
    submissions_count INTEGER;
    matched_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO forms_count FROM forms;
    SELECT COUNT(*) INTO submissions_count FROM submissions;
    
    SELECT COUNT(DISTINCT s.form_id_new) INTO matched_count
    FROM submissions s
    INNER JOIN forms f ON s.form_id_new = f.id_new;
    
    RAISE NOTICE 'Forms: %, Submissions: %, Matched: %', forms_count, submissions_count, matched_count;
    
    IF matched_count = 0 AND submissions_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: No submissions matched to forms';
    END IF;
END $;

-- Log migration progress
DO $
BEGIN
    RAISE NOTICE 'Migration 007 completed successfully';
    RAISE NOTICE 'Submissions with form_id_new: %', (SELECT COUNT(*) FROM submissions WHERE form_id_new IS NOT NULL);
END $;
