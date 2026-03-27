-- Migration 014: Fix question_bank and question_option_history together
-- This handles the dependency between the two tables

-- Step 1: Drop foreign key constraint from question_option_history
ALTER TABLE question_option_history 
DROP CONSTRAINT IF EXISTS fk_question;

-- Step 2: Fix question_bank primary key
ALTER TABLE question_bank 
DROP CONSTRAINT question_bank_pkey CASCADE;

ALTER TABLE question_bank 
ADD PRIMARY KEY (id);

-- Step 3: Fix question_option_history table
-- Add new UUID column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'question_option_history' 
                   AND column_name = 'question_id_new') THEN
        ALTER TABLE question_option_history ADD COLUMN question_id_new UUID;
    END IF;
END $$;

-- Populate question_id_new with UUIDs from question_bank
UPDATE question_option_history qoh
SET question_id_new = qb.id
FROM question_bank qb
WHERE qoh.question_id = qb.sid;

-- Delete orphaned records (if any)
DELETE FROM question_option_history WHERE question_id_new IS NULL;

-- Make question_id_new NOT NULL if it has data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM question_option_history LIMIT 1) THEN
        ALTER TABLE question_option_history ALTER COLUMN question_id_new SET NOT NULL;
    END IF;
END $$;

-- Rename columns if not already renamed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'question_option_history' 
               AND column_name = 'question_id' 
               AND data_type = 'character varying') THEN
        ALTER TABLE question_option_history RENAME COLUMN question_id TO question_sid;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'question_option_history' 
               AND column_name = 'question_id_new') THEN
        ALTER TABLE question_option_history RENAME COLUMN question_id_new TO question_id;
    END IF;
END $$;

-- Drop old indexes
DROP INDEX IF EXISTS idx_option_history_question_id;
DROP INDEX IF EXISTS idx_option_history_question_option;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_option_history_question_id ON question_option_history(question_id);
CREATE INDEX IF NOT EXISTS idx_option_history_question_sid ON question_option_history(question_sid);
CREATE INDEX IF NOT EXISTS idx_option_history_question_option ON question_option_history(question_id, option_key);

-- Add new foreign key constraint (UUID -> UUID)
ALTER TABLE question_option_history 
ADD CONSTRAINT fk_question 
FOREIGN KEY (question_id) 
REFERENCES question_bank(id) 
ON DELETE CASCADE;

-- Clean up duplicate column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'question_option_history' 
               AND column_name = 'question_id_new') THEN
        ALTER TABLE question_option_history DROP COLUMN question_id_new;
    END IF;
END $$;
