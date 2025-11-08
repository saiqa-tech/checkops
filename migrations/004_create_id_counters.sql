-- Create id_counters table for human-readable ID generation
CREATE TABLE IF NOT EXISTS id_counters (
    entity_type VARCHAR(50) PRIMARY KEY,
    current_value INTEGER NOT NULL DEFAULT 0
);

-- Initialize counters for each entity type
INSERT INTO id_counters (entity_type, current_value) VALUES
    ('form', 0),
    ('question', 0),
    ('submission', 0)
ON CONFLICT (entity_type) DO NOTHING;

-- Create function to get next ID for an entity type
CREATE OR REPLACE FUNCTION get_next_id(entity VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    UPDATE id_counters 
    SET current_value = current_value + 1 
    WHERE entity_type = entity
    RETURNING current_value INTO next_val;
    
    RETURN next_val;
END;
$$ LANGUAGE plpgsql;
