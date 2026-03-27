-- Migration 016: Create Findings Table for Risk Management
-- This adds the findings table to support structured failure tracking
-- for compliance, audit, and risk management workflows

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create findings table
CREATE TABLE public.findings (
  -- IDs (dual-ID system)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sid VARCHAR(20) UNIQUE NOT NULL,
  
  -- Foreign Keys (all required, cascade delete)
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_sid VARCHAR(20) NOT NULL,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  question_sid VARCHAR(20) NOT NULL,
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_sid VARCHAR(20) NOT NULL,
  
  -- Finding Data (all nullable - consuming app enforces requirements)
  severity VARCHAR(100),           -- e.g., "Minor", "Major", "Critical"
  department VARCHAR(100),         -- e.g., "Operations", "Maintenance"
  observation TEXT,                -- What was observed
  root_cause VARCHAR(100),         -- Why it happened
  evidence_urls TEXT[],            -- Array of evidence URLs
  assignment JSONB DEFAULT '[]',   -- Array of assignment objects
  status VARCHAR(50),              -- e.g., "open", "in_progress", "resolved", "closed"
  
  -- System Fields
  metadata JSONB DEFAULT '{}',     -- Extensibility
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Create indexes for query performance
CREATE INDEX idx_findings_submission_sid ON public.findings(submission_sid);
CREATE INDEX idx_findings_question_sid ON public.findings(question_sid);
CREATE INDEX idx_findings_form_sid ON public.findings(form_sid);
CREATE INDEX idx_findings_severity ON public.findings(severity);
CREATE INDEX idx_findings_department ON public.findings(department);
CREATE INDEX idx_findings_status ON public.findings(status);
CREATE INDEX idx_findings_created_at ON public.findings(created_at DESC);
CREATE INDEX idx_findings_assignment ON public.findings USING GIN (assignment);

-- Add SID counter for findings
INSERT INTO sid_counters (entity_type, counter) 
VALUES ('finding', 0) 
ON CONFLICT (entity_type) DO NOTHING;

-- Verification
DO $$
DECLARE
    findings_table_exists BOOLEAN;
    index_count INTEGER;
    counter_exists BOOLEAN;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name = 'findings'
    ) INTO findings_table_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'findings';
    
    -- Check if counter exists
    SELECT EXISTS (
        SELECT FROM sid_counters
        WHERE entity_type = 'finding'
    ) INTO counter_exists;
    
    RAISE NOTICE 'Migration 016 completed successfully';
    RAISE NOTICE '  Findings table created: %', findings_table_exists;
    RAISE NOTICE '  Indexes created: %', index_count;
    RAISE NOTICE '  SID counter initialized: %', counter_exists;
    
    IF NOT findings_table_exists THEN
        RAISE EXCEPTION 'Migration failed: findings table not created';
    END IF;
    
    IF index_count < 8 THEN
        RAISE EXCEPTION 'Migration failed: expected 8 indexes, found %', index_count;
    END IF;
    
    IF NOT counter_exists THEN
        RAISE EXCEPTION 'Migration failed: SID counter not initialized';
    END IF;
END $$;
