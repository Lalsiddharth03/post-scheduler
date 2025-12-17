-- Migration: Create maintenance and cleanup functions
-- This migration adds functions for database maintenance and cleanup

-- Function to clean up old scheduler metrics (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_scheduler_metrics()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM scheduler_metrics 
    WHERE started_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION cleanup_old_scheduler_metrics() IS 'Removes scheduler metrics older than 90 days, returns count of deleted records';

-- Function to get scheduler performance statistics
CREATE OR REPLACE FUNCTION get_scheduler_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    total_executions BIGINT,
    avg_duration_ms NUMERIC,
    total_posts_processed BIGINT,
    total_posts_published BIGINT,
    total_errors BIGINT,
    success_rate NUMERIC
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_executions,
        ROUND(AVG(execution_duration_ms), 2) as avg_duration_ms,
        SUM(posts_processed)::BIGINT as total_posts_processed,
        SUM(posts_published)::BIGINT as total_posts_published,
        SUM(errors_encountered)::BIGINT as total_errors,
        CASE 
            WHEN SUM(posts_processed) > 0 THEN 
                ROUND((SUM(posts_published)::NUMERIC / SUM(posts_processed)::NUMERIC) * 100, 2)
            ELSE 0
        END as success_rate
    FROM scheduler_metrics 
    WHERE started_at >= NOW() - (days_back || ' days')::INTERVAL;
END;
$ LANGUAGE plpgsql STABLE;

-- Add comment for the function
COMMENT ON FUNCTION get_scheduler_stats(INTEGER) IS 'Returns scheduler performance statistics for the specified number of days';

-- Function to find posts with timezone inconsistencies
CREATE OR REPLACE FUNCTION find_timezone_inconsistencies()
RETURNS TABLE(
    post_id UUID,
    user_id UUID,
    user_timezone TEXT,
    original_scheduled_time TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    issue_description TEXT
) AS $
BEGIN
    RETURN QUERY
    -- Posts with timezone but no original_scheduled_time
    SELECT 
        p.id as post_id,
        p.user_id,
        p.user_timezone,
        p.original_scheduled_time,
        p.scheduled_at,
        'Has timezone but missing original_scheduled_time'::TEXT as issue_description
    FROM posts p
    WHERE p.user_timezone IS NOT NULL 
    AND p.scheduled_at IS NOT NULL 
    AND p.original_scheduled_time IS NULL
    
    UNION ALL
    
    -- Posts with original_scheduled_time but no timezone
    SELECT 
        p.id as post_id,
        p.user_id,
        p.user_timezone,
        p.original_scheduled_time,
        p.scheduled_at,
        'Has original_scheduled_time but missing timezone'::TEXT as issue_description
    FROM posts p
    WHERE p.user_timezone IS NULL 
    AND p.original_scheduled_time IS NOT NULL
    
    UNION ALL
    
    -- Posts with invalid timezone format
    SELECT 
        p.id as post_id,
        p.user_id,
        p.user_timezone,
        p.original_scheduled_time,
        p.scheduled_at,
        'Invalid timezone format'::TEXT as issue_description
    FROM posts p
    WHERE p.user_timezone IS NOT NULL 
    AND NOT validate_timezone(p.user_timezone);
END;
$ LANGUAGE plpgsql STABLE;

-- Add comment for the function
COMMENT ON FUNCTION find_timezone_inconsistencies() IS 'Identifies posts with timezone-related data inconsistencies';

-- Function to migrate posts with missing timezone data
CREATE OR REPLACE FUNCTION migrate_posts_missing_timezone()
RETURNS INTEGER AS $
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update posts that have scheduled_at but no timezone info
    -- Assume they were created in UTC (safest assumption)
    UPDATE posts 
    SET 
        user_timezone = 'UTC',
        original_scheduled_time = scheduled_at::TEXT
    WHERE user_timezone IS NULL 
    AND scheduled_at IS NOT NULL
    AND status IN ('SCHEDULED', 'PUBLISHED');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION migrate_posts_missing_timezone() IS 'Migrates posts missing timezone data by setting UTC as default';

-- Create a view for scheduler monitoring
CREATE OR REPLACE VIEW scheduler_monitoring AS
SELECT 
    execution_id,
    started_at,
    completed_at,
    posts_processed,
    posts_published,
    errors_encountered,
    execution_duration_ms,
    CASE 
        WHEN completed_at IS NULL THEN 'RUNNING'
        WHEN errors_encountered > 0 THEN 'COMPLETED_WITH_ERRORS'
        ELSE 'COMPLETED_SUCCESS'
    END as execution_status,
    CASE 
        WHEN posts_processed > 0 THEN 
            ROUND((posts_published::NUMERIC / posts_processed::NUMERIC) * 100, 2)
        ELSE 0
    END as success_rate_percent
FROM scheduler_metrics
ORDER BY started_at DESC;

-- Add comment for the view
COMMENT ON VIEW scheduler_monitoring IS 'Provides enhanced scheduler metrics with calculated status and success rates';