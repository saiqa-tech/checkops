-- Migration 011: Fix question_option_history table for v4.0.0
-- This table was missed in the initial migration
--
-- What this does:
-- 1. Drop old foreign key constraint
-- 2. Add new UUID column for question_id
-- 3. Populate it with UUIDs from question_bank
-- 4. Swap columns (question_id -> question_sid, question_id_new -> question_id)
-- 5. Add new foreign key constraint to question_bank(id)

-- Step 1: Drop old foreign key constraint
ALTER TABLE question_option_history 
DROP CONSTRAINT IF EXISTS fk_question;

-- Step 2: Add new UUID column
ALTER TABLE question_option_history 
ADD COLUMN question_id_new UUID;

-- Step 3: Populate question_id_new with UUIDs from question_bank
UPDATE question_option_history qoh
SET question_id_new = qb.id
FROM question_bank qb
WHERE qoh.question_id = qb.sid;

-- Step 4: Verify all records have a valid question_id_new
DO $
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM question_option_history
    WHERE question_id_new IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE WARNING '% question_option_history records have no matching question_id_new (orphaned records)', orphaned_count;
        -- Delete orphaned records
        DELETE FROM question_option_history WHERE question_id_new IS NULL;
        RAISE NOTICE 'Deleted % orphaned records', orphaned_count;
    END IF;
    
    RAISE NOTICE 'All question_option_history records have valid question_id_new';
END $;

-- Step 5: Make question_id_new NOT NULL
ALTER TABLE question_option_history 
ALTER COLUMN question_id_new SET NOT NULL;

-- Step 6: Rename columns
ALTER TABLE question_option_history 
RENAME COLUMN question_id TO question_sid;

ALTER TABLE question_option_history 
RENAME COLUMN question_id_new TO question_id;

-- Step 7: Update indexes
DROP INDEX IF EXISTS idx_option_history_question_id;
DROP INDEX IF EXISTS idx_option_history_question_option;

CREATE INDEX idx_option_history_question_id ON question_option_history(question_id);
CREATE INDEX idx_option_history_question_sid ON question_option_history(question_sid);
CREATE INDEX idx_option_history_question_option ON question_option_history(question_id, option_key);

-- Step 8: Add new foreign key constraint (UUID -> UUID)
ALTER TABLE question_option_history 
ADD CONSTRAINT fk_question 
FOREIGN KEY (question_id) 
REFERENCES question_bank(id) 
ON DELETE CASCADE;

-- Verification
DO $
DECLARE
    history_count INTEGER;
    fk_violations INTEGER;
BEGIN
    SELECT COUNT(*) INTO history_count FROM question_option_history;
    
    -- Check for foreign key violations
    SELECT COUNT(*) INTO fk_violations
    FROM question_option_history qoh
    LEFT JOIN question_bank qb ON qoh.question_id = qb.id
    WHERE qb.id IS NULL;
    
    RAISE NOTICE 'Migration 011 verification:';
    RAISE NOTICE '  Option history records: %', history_count;
    RAISE NOTICE '  FK violations: %', fk_violations;
    
    IF fk_violations > 0 THEN
        RAISE EXCEPTION 'Migration failed: % foreign key violations detected', fk_violations;
    END IF;
    
    RAISE NOTICE 'Migration 011 completed successfully';
END $;
