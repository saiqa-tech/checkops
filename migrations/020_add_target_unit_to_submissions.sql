-- Migration 020: Add target_unit_id and submitter_user_id to submissions table
--
-- target_unit_id: The UUID of the store that was AUDITED in this submission.
--   This answers "Which store was checked?" — the question every report needs.
--   It is NULLABLE because existing rows from before Phase 3 have no recorded
--   target unit. New submissions created after this migration will always have
--   a value; old ones will remain NULL.
--
-- submitter_user_id: The UUID of the user who submitted this audit.
--   Nullable for the same backward-compatibility reason. Old submissions may
--   have stored the submitter as a text string inside metadata.submittedBy.
--   This is a proper indexed column for the same information.
--
-- INDEXES:
--   idx_submissions_target_unit_id — Phase 4 will filter submissions by
--   target_unit_id constantly (scope-filtered lists, dashboards). Without this
--   index every query scans the entire submissions table. With it, the database
--   jumps straight to matching rows. Performance-critical.
--
--   idx_submissions_submitter_user_id — for filtering/searching by submitter.
--
-- RULE (non-negotiable):
--   target_unit_id stores the AUDITED STORE, never the submitter's home unit.
--   A Regional Manager auditing SSS TDM Dubai stores SSS TDM Dubai's UUID here,
--   regardless of which unit the Regional Manager belongs to.

-- Each column is added in its own statement with IF NOT EXISTS so this file
-- is safe to run on a database where it was previously applied manually.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_unit_id    UUID;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitter_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_submissions_target_unit_id    ON submissions(target_unit_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter_user_id ON submissions(submitter_user_id);
