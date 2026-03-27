-- Migration 018: Increase root_cause column from VARCHAR(100) to TEXT
-- VARCHAR(100) is too restrictive for real root cause analysis text.

ALTER TABLE public.findings ALTER COLUMN root_cause TYPE TEXT;
