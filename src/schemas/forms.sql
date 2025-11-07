-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Form fields table (for form schema definitions)
CREATE TABLE IF NOT EXISTS form_fields (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    options JSONB,
    validation JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    default_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for forms
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_at);
CREATE INDEX IF NOT EXISTS idx_forms_created_at_desc ON forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forms_schema_gin ON forms USING GIN(schema);

-- Indexes for form_fields
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_name ON form_fields(name);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields("order");