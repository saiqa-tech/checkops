-- Create question_option_history table to track option label changes
CREATE TABLE IF NOT EXISTS question_option_history (
    id SERIAL PRIMARY KEY,
    question_id VARCHAR(50) NOT NULL,
    option_key VARCHAR(100) NOT NULL,
    old_label TEXT,
    new_label TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100),
    change_reason TEXT,
    CONSTRAINT fk_question FOREIGN KEY (question_id) 
        REFERENCES question_bank(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_option_history_question_id ON question_option_history(question_id);
CREATE INDEX IF NOT EXISTS idx_option_history_option_key ON question_option_history(option_key);
CREATE INDEX IF NOT EXISTS idx_option_history_changed_at ON question_option_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_option_history_question_option ON question_option_history(question_id, option_key);
