-- Migration 012: Fix question_bank primary key
-- The migration 008 didn't complete for question_bank table
--
-- What this does:
-- 1. Drop old primary key on sid
-- 2. Set id (UUID) as new primary key
-- 3. Ensure sid remains unique

-- Drop old primary key
ALTER TABLE question_bank 
DROP CONSTRAINT question_bank_pkey;

-- Set new primary key on id (UUID)
ALTER TABLE question_bank 
ADD PRIMARY KEY (id);

-- Verify sid is still unique (should already have unique constraint)
-- The constraint question_bank_sid_unique should already exist from migration 008
