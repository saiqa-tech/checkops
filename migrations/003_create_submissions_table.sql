-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(50) PRIMARY KEY,
    form_id VARCHAR(50) NOT NULL,
    submission_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_data ON submissions USING GIN (submission_data);
CREATE INDEX IF NOT EXISTS idx_submissions_metadata ON submissions USING GIN (metadata);
