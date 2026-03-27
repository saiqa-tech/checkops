-- Migration 006: Add UUID columns to all tables
-- This is Phase 1 of the v4.0.0 dual-ID system migration
-- 
-- What this does:
-- 1. Adds id_new (UUID) column to forms, question_bank, submissions
-- 2. Generates UUIDs for all existing records
-- 3. Creates indexes on UUID columns
-- 4. Adds mapping table for UUID <-> SID relationships

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add UUID columns to forms table
ALTER TABLE forms 
ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add UUID columns to question_bank table
ALTER TABLE question_bank 
ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add UUID columns to submissions table
ALTER TABLE submissions 
ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;

-- Create unique indexes on new UUID columns
CREATE UNIQUE INDEX idx_forms_id_new ON forms(id_new);
CREATE UNIQUE INDEX idx_question_bank_id_new ON question_bank(id_new);
CREATE UNIQUE INDEX idx_submissions_id_new ON submissions(id_new);

-- Create mapping table for UUID <-> SID lookups (temporary, for migration)
CREATE TABLE id_mapping (
    entity_type VARCHAR(20) NOT NULL,
    old_id VARCHAR(50) NOT NULL,
    new_id UUID NOT NULL,
    PRIMARY KEY (entity_type, old_id)
);

-- Populate mapping table
INSERT INTO id_mapping (entity_type, old_id, new_id)
SELECT 'form', id, id_new FROM forms;

INSERT INTO id_mapping (entity_type, old_id, new_id)
SELECT 'question', id, id_new FROM question_bank;

INSERT INTO id_mapping (entity_type, old_id, new_id)
SELECT 'submission', id, id_new FROM submissions;

-- Create indexes on mapping table for fast lookups
CREATE INDEX idx_id_mapping_old_id ON id_mapping(entity_type, old_id);
CREATE INDEX idx_id_mapping_new_id ON id_mapping(entity_type, new_id);

-- Verification queries (run these to verify migration)
-- SELECT COUNT(*) FROM forms WHERE id_new IS NULL;  -- Should be 0
-- SELECT COUNT(*) FROM question_bank WHERE id_new IS NULL;  -- Should be 0
-- SELECT COUNT(*) FROM submissions WHERE id_new IS NULL;  -- Should be 0
-- SELECT COUNT(*) FROM id_mapping;  -- Should equal total records

-- Log migration progress
DO $
BEGIN
    RAISE NOTICE 'Migration 006 completed successfully';
    RAISE NOTICE 'Forms with UUID: %', (SELECT COUNT(*) FROM forms WHERE id_new IS NOT NULL);
    RAISE NOTICE 'Questions with UUID: %', (SELECT COUNT(*) FROM question_bank WHERE id_new IS NOT NULL);
    RAISE NOTICE 'Submissions with UUID: %', (SELECT COUNT(*) FROM submissions WHERE id_new IS NOT NULL);
    RAISE NOTICE 'Mapping entries: %', (SELECT COUNT(*) FROM id_mapping);
END $;
