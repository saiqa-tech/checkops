-- CheckOps Form Builder Database Schema
-- PostgreSQL 13+ with JSONB support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Counter table for generating sequential IDs
CREATE TABLE IF NOT EXISTS counters (
    id VARCHAR(255) PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for counters
CREATE INDEX IF NOT EXISTS idx_counters_id ON counters(id);

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    schema JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    metadata JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for forms
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at);
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);
CREATE INDEX IF NOT EXISTS idx_forms_schema_gin ON forms USING GIN(schema);
CREATE INDEX IF NOT EXISTS idx_forms_title_gin ON forms USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_forms_description_gin ON forms USING GIN(to_tsvector('english', description));

-- Form versions table for tracking schema changes
CREATE TABLE IF NOT EXISTS form_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    schema JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    metadata JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for form_versions
CREATE INDEX IF NOT EXISTS idx_form_versions_form_id ON form_versions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_versions_version ON form_versions(form_id, version);
CREATE INDEX IF NOT EXISTS idx_form_versions_created_at ON form_versions(created_at);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    submission_id VARCHAR(255) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    metadata JSONB,
    source VARCHAR(100),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'archived')),
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submission_id ON submissions(submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_data_gin ON submissions USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_submissions_data_tsvector ON submissions USING GIN(to_tsvector('english', data::text));
CREATE INDEX IF NOT EXISTS idx_submissions_composite ON submissions(form_id, status, submitted_at);

-- API Keys table for authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON api_keys(last_used_at);

-- Audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Insert initial counters
INSERT INTO counters (id, value) VALUES 
    ('forms', 1),
    ('api_keys', 1)
ON CONFLICT (id) DO NOTHING;

-- Create or replace function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_counters_updated_at BEFORE UPDATE ON counters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for active forms with their latest version
CREATE OR REPLACE VIEW active_forms AS
SELECT 
    f.id,
    f.title,
    f.description,
    f.version,
    f.schema,
    f.metadata,
    f.created_by,
    f.created_at,
    f.updated_at
FROM forms f
WHERE f.status = 'active'
ORDER BY f.created_at DESC;

-- Create view for submission statistics
CREATE OR REPLACE VIEW submission_stats AS
SELECT 
    f.id as form_id,
    f.title as form_title,
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.status = 'pending' THEN 1 END) as pending_submissions,
    COUNT(CASE WHEN s.status = 'processed' THEN 1 END) as processed_submissions,
    COUNT(CASE WHEN s.status = 'failed' THEN 1 END) as failed_submissions,
    COUNT(CASE WHEN s.submitted_at >= CURRENT_DATE THEN 1 END) as today_submissions,
    MAX(s.submitted_at) as last_submission_at
FROM forms f
LEFT JOIN submissions s ON f.id = s.form_id
WHERE f.status = 'active'
GROUP BY f.id, f.title
ORDER BY total_submissions DESC;