-- Migration 017: Enforce findings schema placement and root_cause type
-- Ensures findings table exists in default public schema and root_cause is VARCHAR(100)

DO $$
DECLARE
    has_public_findings BOOLEAN;
    has_checkops_findings BOOLEAN;
    oversized_root_cause_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'findings'
    ) INTO has_public_findings;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'checkops'
          AND table_name = 'findings'
    ) INTO has_checkops_findings;

    IF has_public_findings AND has_checkops_findings THEN
        RAISE EXCEPTION 'Migration 017 failed: both public.findings and checkops.findings exist';
    END IF;

    IF has_checkops_findings THEN
        EXECUTE 'ALTER TABLE checkops.findings SET SCHEMA public';
        has_public_findings := TRUE;
        RAISE NOTICE 'Moved findings table from checkops schema to public schema';
    END IF;

    IF NOT has_public_findings THEN
        RAISE EXCEPTION 'Migration 017 failed: public.findings table does not exist';
    END IF;

    SELECT COUNT(*)
    INTO oversized_root_cause_count
    FROM public.findings
    WHERE root_cause IS NOT NULL
      AND LENGTH(root_cause) > 100;

    IF oversized_root_cause_count > 0 THEN
        RAISE EXCEPTION
            'Migration 017 failed: % row(s) have root_cause longer than 100 characters',
            oversized_root_cause_count;
    END IF;

    ALTER TABLE public.findings
    ALTER COLUMN root_cause TYPE VARCHAR(100);

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'findings'
          AND column_name = 'root_cause'
          AND data_type = 'character varying'
          AND character_maximum_length = 100
    ) THEN
        RAISE EXCEPTION 'Migration 017 failed: public.findings.root_cause is not VARCHAR(100)';
    END IF;

    RAISE NOTICE 'Migration 017 completed successfully';
END $$;
