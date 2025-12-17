-- Migration: Database optimizations for timezone scheduler
-- This migration adds final optimizations and configurations

-- Enable row-level security (RLS) for posts table if not already enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for posts - users can only access their own posts
CREATE POLICY posts_user_access ON posts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable RLS for user_preferences table
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_preferences - users can only access their own preferences
CREATE POLICY user_preferences_user_access ON user_preferences
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Scheduler metrics should be accessible only to service role (not regular users)
ALTER TABLE scheduler_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for scheduler_metrics - only service role can access
CREATE POLICY scheduler_metrics_service_access ON scheduler_metrics
    FOR ALL
    TO service_role
    USING (true);

-- Create partial indexes for better performance on large datasets
-- Index for active scheduled posts (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_posts_active_scheduled 
ON posts (scheduled_at ASC) 
WHERE status = 'SCHEDULED' AND scheduled_at > NOW();

-- Index for recently published posts (for analytics)
CREATE INDEX IF NOT EXISTS idx_posts_recent_published 
ON posts (published_at DESC) 
WHERE status = 'PUBLISHED' AND published_at > NOW() - INTERVAL '30 days';

-- Index for posts by user and status (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_posts_user_status_recent 
ON posts (user_id, status, created_at DESC);

-- Covering index for scheduler queries (includes all needed columns)
CREATE INDEX IF NOT EXISTS idx_posts_scheduler_covering 
ON posts (status, scheduled_at) 
INCLUDE (id, user_id, content, user_timezone, original_scheduled_time)
WHERE status = 'SCHEDULED';

-- Create expression index for timezone-aware queries
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at_timezone 
ON posts ((scheduled_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) 
WHERE status = 'SCHEDULED';

-- Add database-level constraints for referential integrity
-- Ensure posts.user_id references valid users (if auth.users table exists)
-- Note: This assumes Supabase auth schema, adjust if different
DO $
BEGIN
    -- Check if auth.users table exists before adding foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_posts_user_id' 
            AND table_name = 'posts'
        ) THEN
            ALTER TABLE posts 
            ADD CONSTRAINT fk_posts_user_id 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END;
$;

-- Set up automatic vacuum and analyze for performance
-- Configure autovacuum settings for posts table (high write volume)
ALTER TABLE posts SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_cost_delay = 10
);

-- Configure autovacuum for scheduler_metrics (frequent inserts)
ALTER TABLE scheduler_metrics SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

-- Set up connection pooling optimization hints
-- These are PostgreSQL-specific optimizations
ALTER DATABASE postgres SET timezone = 'UTC';
ALTER DATABASE postgres SET log_timezone = 'UTC';

-- Create database functions for common timezone operations
-- Function to get user's timezone preference
CREATE OR REPLACE FUNCTION get_user_timezone(user_uuid UUID)
RETURNS TEXT AS $
DECLARE
    user_tz TEXT;
BEGIN
    SELECT timezone INTO user_tz 
    FROM user_preferences 
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(user_tz, 'UTC');
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comment for the function
COMMENT ON FUNCTION get_user_timezone(UUID) IS 'Returns user timezone preference with UTC fallback';

-- Function to convert post times to user timezone
CREATE OR REPLACE FUNCTION get_post_in_user_timezone(
    post_uuid UUID,
    user_uuid UUID
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    status TEXT,
    scheduled_at_user_tz TIMESTAMP WITH TIME ZONE,
    published_at_user_tz TIMESTAMP WITH TIME ZONE,
    created_at_user_tz TIMESTAMP WITH TIME ZONE
) AS $
DECLARE
    user_tz TEXT;
BEGIN
    -- Get user timezone
    user_tz := get_user_timezone(user_uuid);
    
    RETURN QUERY
    SELECT 
        p.id,
        p.content,
        p.status::TEXT,
        CASE 
            WHEN p.scheduled_at IS NOT NULL THEN p.scheduled_at AT TIME ZONE user_tz
            ELSE NULL
        END as scheduled_at_user_tz,
        CASE 
            WHEN p.published_at IS NOT NULL THEN p.published_at AT TIME ZONE user_tz
            ELSE NULL
        END as published_at_user_tz,
        p.created_at AT TIME ZONE user_tz as created_at_user_tz
    FROM posts p
    WHERE p.id = post_uuid AND p.user_id = user_uuid;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comment for the function
COMMENT ON FUNCTION get_post_in_user_timezone(UUID, UUID) IS 'Returns post with timestamps converted to user timezone';

-- Create monitoring view for database health
CREATE OR REPLACE VIEW database_health AS
SELECT 
    'posts' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_count,
    COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published_count,
    COUNT(*) FILTER (WHERE status = 'DRAFT') as draft_count,
    COUNT(*) FILTER (WHERE user_timezone IS NULL) as missing_timezone_count
FROM posts

UNION ALL

SELECT 
    'user_preferences' as table_name,
    COUNT(*) as total_records,
    NULL as scheduled_count,
    NULL as published_count,
    NULL as draft_count,
    COUNT(*) FILTER (WHERE timezone = 'UTC') as missing_timezone_count
FROM user_preferences

UNION ALL

SELECT 
    'scheduler_metrics' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as scheduled_count,
    COUNT(*) FILTER (WHERE errors_encountered = 0) as published_count,
    COUNT(*) FILTER (WHERE errors_encountered > 0) as draft_count,
    NULL as missing_timezone_count
FROM scheduler_metrics;

-- Add comment for the view
COMMENT ON VIEW database_health IS 'Provides overview of database health and data distribution';

-- Final statistics update
ANALYZE posts;
ANALYZE user_preferences;
ANALYZE scheduler_metrics;