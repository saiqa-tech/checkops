-- Migration 021: Add target_unit_id to findings table
--
-- A finding belongs to a submission, and every submission has a target_unit_id
-- (the audited store).  Denormalising target_unit_id directly onto findings:
--   - enables direct unit-scoped queries without joining through submissions
--   - makes findings independently queryable by location (valuable for
--     cross-industry and MCP-server use cases)
--   - is consistent with how submission_id is already denormalised here
--
-- NOTE: target_unit_id is nullable because findings created before Phase 3
-- (when submissions had no target_unit_id) will not have this value.

ALTER TABLE public.findings
    ADD COLUMN IF NOT EXISTS target_unit_id UUID;

-- Back-fill from parent submissions for all existing findings whose
-- parent submission already carries a target_unit_id.
UPDATE public.findings f
SET    target_unit_id = s.target_unit_id
FROM   submissions s
WHERE  f.submission_id   = s.id
  AND  s.target_unit_id  IS NOT NULL
  AND  f.target_unit_id  IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_target_unit_id
    ON public.findings(target_unit_id);
