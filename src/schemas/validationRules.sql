-- Validation rules table
CREATE TABLE IF NOT EXISTS validation_rules (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('required', 'min_length', 'max_length', 'pattern', 'email', 'number_range', 'custom')),
    parameters JSONB NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for validation_rules
CREATE INDEX IF NOT EXISTS idx_validation_rules_field_id ON validation_rules(field_id);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_created_at ON validation_rules(created_at DESC);