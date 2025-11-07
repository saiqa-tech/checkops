-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id VARCHAR(255) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled')),
    submitted_by VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Submission history table
CREATE TABLE IF NOT EXISTS submission_history (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id VARCHAR(255) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'processed', 'failed')),
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at_desc ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_data_gin ON submissions USING GIN(data);

-- Indexes for submission_history
CREATE INDEX IF NOT EXISTS idx_submission_history_submission_id ON submission_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_history_action ON submission_history(action);
CREATE INDEX IF NOT EXISTS idx_submission_history_performed_by ON submission_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_submission_history_performed_at ON submission_history(performed_at DESC);