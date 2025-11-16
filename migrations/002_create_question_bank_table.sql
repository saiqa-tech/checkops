-- Create function to validate unique option keys
CREATE OR REPLACE FUNCTION validate_unique_option_keys(options JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- If options is null or not an array, it's valid
    IF options IS NULL OR jsonb_typeof(options) != 'array' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if all keys in the options array are unique
    -- Count total keys vs distinct keys
    RETURN (
        SELECT COUNT(*) = COUNT(DISTINCT elem->>'key')
        FROM jsonb_array_elements(options) AS elem
        WHERE elem->>'key' IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create question_bank table
CREATE TABLE IF NOT EXISTS question_bank (
    id VARCHAR(50) PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    options JSONB,
    validation_rules JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_question_type CHECK (question_type IN (
        'text', 'textarea', 'number', 'email', 'phone', 'date', 
        'time', 'datetime', 'select', 'multiselect', 'radio', 
        'checkbox', 'boolean', 'file', 'rating'
    )),
    CONSTRAINT unique_option_keys CHECK (validate_unique_option_keys(options))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_question_bank_question_type ON question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_is_active ON question_bank(is_active);
CREATE INDEX IF NOT EXISTS idx_question_bank_created_at ON question_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_options ON question_bank USING GIN (options);
CREATE INDEX IF NOT EXISTS idx_question_bank_validation_rules ON question_bank USING GIN (validation_rules);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_question_bank_updated_at
    BEFORE UPDATE ON question_bank
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
