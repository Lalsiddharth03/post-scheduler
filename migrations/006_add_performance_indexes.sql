-- Migration: Add additional performance indexes for timezone scheduler
-- This migration adds comprehensive indexes for optimal scheduler performance

-- Index for user-specific post queries with timezone
CREATE INDEX IF NOT EXISTS idx_posts_user_status_scheduled 
ON posts (user_id, status, scheduled_at) 
WHERE status IN ('SCHEDULED', 'PUBLISHED');

-- Composite index for scheduler queries with timezone filtering
CREATE INDEX IF NOT EXISTS idx_posts_scheduler_timezone 
ON posts (status, scheduled_at, user_timezone) 
WHERE status = 'SCHEDULED';

-- Index for published posts with timezone for analytics
CREATE INDEX IF NOT EXISTS idx_posts_published_timezone 
ON posts (published_at, user_timezone) 
WHERE status = 'PUBLISHED' AND published_at IS NOT NULL;

-- Index for posts created in specific timezones (for reporting)
CREATE INDEX IF NOT EXISTS idx_posts_created_timezone 
ON posts (created_at, user_timezone) 
WHERE user_timezone IS NOT NULL;

-- Partial index for posts with original scheduled time (for migration tracking)
CREATE INDEX IF NOT EXISTS idx_posts_original_scheduled 
ON posts (original_scheduled_time) 
WHERE original_scheduled_time IS NOT NULL;

-- Index for user preferences lookup by user_id (should be primary key but ensuring)
-- This is redundant with primary key but explicit for clarity
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences (user_id);

-- Index for finding users by timezone (for bulk operations)
CREATE INDEX IF NOT EXISTS idx_user_preferences_timezone_lookup 
ON user_preferences (timezone, created_at);

-- Composite index for scheduler metrics queries
CREATE INDEX IF NOT EXISTS idx_scheduler_metrics_performance 
ON scheduler_metrics (started_at, execution_duration_ms, posts_processed);

-- Index for error analysis
CREATE INDEX IF NOT EXISTS idx_scheduler_metrics_error_analysis 
ON scheduler_metrics (errors_encountered, started_at) 
WHERE errors_encountered > 0;

-- Add comments for maintenance
COMMENT ON INDEX idx_posts_user_status_scheduled IS 'Optimizes user dashboard queries for scheduled and published posts';
COMMENT ON INDEX idx_posts_scheduler_timezone IS 'Primary index for scheduler batch processing with timezone awareness';
COMMENT ON INDEX idx_posts_published_timezone IS 'Supports analytics queries on published posts by timezone';
COMMENT ON INDEX idx_scheduler_metrics_performance IS 'Optimizes performance monitoring queries';