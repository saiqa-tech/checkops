-- Migration 015: Create SID Counters Table for Concurrent Operations
-- This table provides atomic counter increments for SID generation

CREATE TABLE IF NOT EXISTS sid_counters (
    entity_type VARCHAR(50) PRIMARY KEY,
    counter INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial counters for each entity type
INSERT INTO sid_counters (entity_type, counter)
VALUES 
    ('form', (SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'FORM-(\\d+)') AS INTEGER)), 0) FROM forms WHERE sid ~ '^FORM-[0-9]+$')),
    ('question', (SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'Q-(\\d+)') AS INTEGER)), 0) FROM question_bank WHERE sid ~ '^Q-[0-9]+$')),
    ('submission', (SELECT COALESCE(MAX(CAST(SUBSTRING(sid FROM 'SUB-(\\d+)') AS INTEGER)), 0) FROM submissions WHERE sid ~ '^SUB-[0-9]+$'))
ON CONFLICT (entity_type) DO NOTHING;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_next_sid_counter(VARCHAR);

-- Create function to get next SID counter atomically with explicit type
CREATE OR REPLACE FUNCTION get_next_sid_counter(p_entity_type VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
    v_counter INTEGER;
BEGIN
    UPDATE sid_counters
    SET counter = counter + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE entity_type = p_entity_type
    RETURNING counter INTO v_counter;
    
    RETURN v_counter;
END;
$$ LANGUAGE plpgsql;
