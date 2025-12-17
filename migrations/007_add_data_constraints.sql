-- Migration: Add data constraints and validation for timezone scheduler
-- This migration adds constraints to ensure data integrity

-- Add check constraint for valid post status
ALTER TABLE posts 
ADD CONSTRAINT chk_posts_status 
CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED'));

-- Add check constraint to ensure scheduled posts have scheduled_at
ALTER TABLE posts 
ADD CONSTRAINT chk_posts_scheduled_time 
CHECK (
    (status = 'SCHEDULED' AND scheduled_at IS NOT NULL) OR 
    (status != 'SCHEDULED')
);

-- Add check constraint to ensure published posts have published_at
ALTER TABLE posts 
ADD CONSTRAINT chk_posts_published_time 
CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL) OR 
    (status != 'PUBLISHED')
);

-- Add check constraint for timezone format (basic IANA validation)
ALTER TABLE posts 
ADD CONSTRAINT chk_posts_timezone_format 
CHECK (
    user_timezone IS NULL OR 
    user_timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$' OR 
    user_timezone = 'UTC'
);

-- Add check constraint for user preferences timezone format
ALTER TABLE user_preferences 
ADD CONSTRAINT chk_user_preferences_timezone_format 
CHECK (
    timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$' OR 
    timezone = 'UTC'
);

-- Add check constraint for scheduler metrics non-negative values
ALTER TABLE scheduler_metrics 
ADD CONSTRAINT chk_scheduler_metrics_non_negative 
CHECK (
    posts_processed >= 0 AND 
    posts_published >= 0 AND 
    errors_encountered >= 0 AND 
    (execution_duration_ms IS NULL OR execution_duration_ms >= 0)
);

-- Add check constraint for logical scheduler metrics
ALTER TABLE scheduler_metrics 
ADD CONSTRAINT chk_scheduler_metrics_logical 
CHECK (posts_published <= posts_processed);

-- Add check constraint for completed_at after started_at
ALTER TABLE scheduler_metrics 
ADD CONSTRAINT chk_scheduler_metrics_time_order 
CHECK (
    completed_at IS NULL OR 
    completed_at >= started_at
);

-- Add comments for constraints
COMMENT ON CONSTRAINT chk_posts_status ON posts IS 'Ensures post status is one of the valid values';
COMMENT ON CONSTRAINT chk_posts_scheduled_time ON posts IS 'Ensures scheduled posts have a scheduled_at timestamp';
COMMENT ON CONSTRAINT chk_posts_published_time ON posts IS 'Ensures published posts have a published_at timestamp';
COMMENT ON CONSTRAINT chk_posts_timezone_format ON posts IS 'Basic validation for IANA timezone format';
COMMENT ON CONSTRAINT chk_scheduler_metrics_logical ON scheduler_metrics IS 'Ensures published count does not exceed processed count';