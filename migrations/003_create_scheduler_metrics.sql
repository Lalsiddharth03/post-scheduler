-- Migration: Create scheduler_metrics table
-- This table stores scheduler execution metrics for monitoring

CREATE TABLE scheduler_metrics (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    posts_processed INTEGER DEFAULT 0,
    posts_published INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    execution_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE scheduler_metrics IS 'Scheduler execution metrics for monitoring and debugging';
COMMENT ON COLUMN scheduler_metrics.execution_id IS 'Unique identifier for each scheduler execution';
COMMENT ON COLUMN scheduler_metrics.execution_duration_ms IS 'Total execution time in milliseconds';

-- Create indexes for performance monitoring queries
CREATE INDEX idx_scheduler_metrics_started_at ON scheduler_metrics (started_at);
CREATE INDEX idx_scheduler_metrics_duration ON scheduler_metrics (execution_duration_ms);
CREATE INDEX idx_scheduler_metrics_errors ON scheduler_metrics (errors_encountered) WHERE errors_encountered > 0;

-- Create partial index for recent executions (last 30 days)
CREATE INDEX idx_scheduler_metrics_recent 
ON scheduler_metrics (started_at DESC) 
WHERE started_at > NOW() - INTERVAL '30 days';