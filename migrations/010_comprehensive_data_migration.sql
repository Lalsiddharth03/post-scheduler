-- Migration: Comprehensive data migration for timezone scheduler
-- This migration ensures all existing data is properly migrated and consistent

-- Step 1: Handle posts with missing timezone information
-- For posts that have scheduled_at but no user_timezone, set to UTC
UPDATE posts 
SET 
    user_timezone = 'UTC',
    original_scheduled_time = scheduled_at::TEXT
WHERE user_timezone IS NULL 
AND scheduled_at IS NOT NULL
AND original_scheduled_time IS NULL;

-- Step 2: Handle posts with invalid timezone data
-- Reset invalid timezones to UTC and log the change
UPDATE posts 
SET 
    user_timezone = 'UTC'
WHERE user_timezone IS NOT NULL 
AND NOT validate_timezone(user_timezone);

-- Step 3: Ensure published posts have published_at timestamps
-- For published posts missing published_at, use created_at as fallback
UPDATE posts 
SET published_at = created_at
WHERE status = 'PUBLISHED' 
AND published_at IS NULL;

-- Step 4: Clean up inconsistent post states
-- Draft posts should not have scheduled_at or published_at
UPDATE posts 
SET 
    scheduled_at = NULL,
    published_at = NULL,
    user_timezone = NULL,
    original_scheduled_time = NULL
WHERE status = 'DRAFT' 
AND (scheduled_at IS NOT NULL OR published_at IS NOT NULL);

-- Step 5: Ensure scheduled posts have proper timestamps
-- Scheduled posts must have scheduled_at, if missing set to created_at + 1 hour
UPDATE posts 
SET 
    scheduled_at = created_at + INTERVAL '1 hour',
    user_timezone = COALESCE(user_timezone, 'UTC'),
    original_scheduled_time = COALESCE(original_scheduled_time, (created_at + INTERVAL '1 hour')::TEXT)
WHERE status = 'SCHEDULED' 
AND scheduled_at IS NULL;

-- Step 6: Create default user preferences for users without them
-- This ensures every user has timezone preferences
INSERT INTO user_preferences (user_id, timezone)
SELECT DISTINCT p.user_id, 'UTC'
FROM posts p
LEFT JOIN user_preferences up ON p.user_id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 7: Update user preferences based on most common timezone in their posts
-- If a user has posts with consistent timezone, update their preference
UPDATE user_preferences 
SET timezone = subq.most_common_timezone
FROM (
    SELECT 
        p.user_id,
        p.user_timezone as most_common_timezone,
        COUNT(*) as usage_count,
        ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY COUNT(*) DESC) as rn
    FROM posts p
    WHERE p.user_timezone IS NOT NULL 
    AND p.user_timezone != 'UTC'
    AND validate_timezone(p.user_timezone)
    GROUP BY p.user_id, p.user_timezone
) subq
WHERE user_preferences.user_id = subq.user_id 
AND subq.rn = 1
AND subq.usage_count >= 3  -- Only update if user has at least 3 posts in that timezone
AND user_preferences.timezone = 'UTC';  -- Only update default UTC preferences

-- Step 8: Validate data consistency after migration
-- Create a temporary table to log any remaining issues
CREATE TEMP TABLE migration_issues AS
SELECT 
    'posts' as table_name,
    id::TEXT as record_id,
    'Missing timezone for scheduled post' as issue
FROM posts 
WHERE status = 'SCHEDULED' AND user_timezone IS NULL

UNION ALL

SELECT 
    'posts' as table_name,
    id::TEXT as record_id,
    'Missing scheduled_at for scheduled post' as issue
FROM posts 
WHERE status = 'SCHEDULED' AND scheduled_at IS NULL

UNION ALL

SELECT 
    'posts' as table_name,
    id::TEXT as record_id,
    'Missing published_at for published post' as issue
FROM posts 
WHERE status = 'PUBLISHED' AND published_at IS NULL

UNION ALL

SELECT 
    'posts' as table_name,
    id::TEXT as record_id,
    'Invalid timezone format' as issue
FROM posts 
WHERE user_timezone IS NOT NULL AND NOT validate_timezone(user_timezone)

UNION ALL

SELECT 
    'user_preferences' as table_name,
    user_id::TEXT as record_id,
    'Invalid timezone format in preferences' as issue
FROM user_preferences 
WHERE NOT validate_timezone(timezone);

-- Log migration results
DO $
DECLARE
    issue_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO issue_count FROM migration_issues;
    
    IF issue_count > 0 THEN
        RAISE NOTICE 'Migration completed with % data consistency issues. Check migration_issues table.', issue_count;
        -- In a real system, you would log these to a permanent audit table
    ELSE
        RAISE NOTICE 'Migration completed successfully with no data consistency issues.';
    END IF;
END;
$;

-- Clean up temporary table
DROP TABLE migration_issues;

-- Step 9: Update statistics for query planner
ANALYZE posts;
ANALYZE user_preferences;
ANALYZE scheduler_metrics;