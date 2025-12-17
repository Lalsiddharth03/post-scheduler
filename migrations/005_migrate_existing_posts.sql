-- Migration: Migrate existing posts to new timezone schema
-- This migration handles existing posts that don't have timezone information

-- Set default timezone for existing posts without timezone info
-- All existing scheduled_at times are assumed to be in UTC
UPDATE posts 
SET 
    user_timezone = 'UTC',
    original_scheduled_time = scheduled_at
WHERE user_timezone IS NULL 
AND scheduled_at IS NOT NULL;

-- For posts without scheduled times, we don't need timezone info
-- but we can set original_scheduled_time to NULL for consistency
UPDATE posts 
SET original_scheduled_time = NULL
WHERE scheduled_at IS NULL 
AND original_scheduled_time IS NOT NULL;