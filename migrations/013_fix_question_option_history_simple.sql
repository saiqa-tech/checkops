-- Migration 013: Fix question_option_history table for v4.0.0 (simplified)

-- Drop old foreign key constraint
ALTER TABLE question_option_history 
DROP CONSTRAINT IF EXISTS fk_question;

-- Add new UUID column
ALTER TABLE question_option_history 
ADD COLUMN question_id_new UUID;

-- Populate question_id_new with UUIDs from question_bank
UPDATE question_option_history qoh
SET question_id_new = qb.id
FROM question_bank qb
WHERE qoh.question_id = qb.sid;

-- Delete orphaned records (if any)
DELETE FROM question_option_history WHERE question_id_new IS NULL;

-- Make question_id_new NOT NULL
ALTER TABLE question_option_history 
ALTER COLUMN question_id_new SET NOT NULL;

-- Rename columns
ALTER TABLE question_option_history 
RENAME COLUMN question_id TO question_sid;

ALTER TABLE question_option_history 
RENAME COLUMN question_id_new TO question_id;

-- Update indexes
DROP INDEX IF EXISTS idx_option_history_question_id;
DROP INDEX IF EXISTS idx_option_history_question_option;

CREATE INDEX idx_option_history_question_id ON question_option_history(question_id);
CREATE INDEX idx_option_history_question_sid ON question_option_history(question_sid);
CREATE INDEX idx_option_history_question_option ON question_option_history(question_id, option_key);

-- Add new foreign key constraint (UUID -> UUID)
ALTER TABLE question_option_history 
ADD CONSTRAINT fk_question 
FOREIGN KEY (question_id) 
REFERENCES question_bank(id) 
ON DELETE CASCADE;
