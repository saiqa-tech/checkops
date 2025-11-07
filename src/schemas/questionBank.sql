-- Question banks table
CREATE TABLE IF NOT EXISTS question_banks (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    question_bank_id VARCHAR(255) NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    options JSONB,
    required BOOLEAN NOT NULL DEFAULT false,
    validation JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for question_banks
CREATE INDEX IF NOT EXISTS idx_question_banks_is_public ON question_banks(is_public);
CREATE INDEX IF NOT EXISTS idx_question_banks_created_by ON question_banks(created_by);
CREATE INDEX IF NOT EXISTS idx_question_banks_created_at ON question_banks(created_at);

-- Indexes for questions
CREATE INDEX IF NOT EXISTS idx_questions_question_bank_id ON questions(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions("order");
CREATE INDEX IF NOT EXISTS idx_questions_text_gin ON questions USING GIN(to_tsvector('english', text));