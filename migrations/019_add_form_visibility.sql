-- Migration 019: Add require_all column to forms table
--
-- Stores the AND/OR match mode for a form's tag rules:
--   true  → AND logic (store must match ALL required tags)
--   false → OR  logic (store needs to match ANY required tag)
--
-- Why boolean not JSONB: storing { "require_all": true } in JSONB is over-engineering
-- for a single boolean value. A plain BOOLEAN column is simpler and needs no GIN index.
--
-- The allowedDesignationIds and requiresTags parts of visibility live in
-- saiqa-server's form_applicability_designation_map and form_applicability_tag_map
-- tables. This column only stores the match mode boolean.

ALTER TABLE forms
ADD COLUMN IF NOT EXISTS require_all BOOLEAN NOT NULL DEFAULT true;
