-- Migration: Add timezone fields to posts table
-- This migration adds timezone support to the existing posts table

-- Add timezone-related columns to posts table
ALTER TABLE posts 
ADD COLUMN user_timezone TEXT,
ADD COLUMN original_scheduled_time TEXT;

-- Add comments for clarity
COMMENT ON COLUMN posts.user_timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN posts.original_scheduled_time IS 'User original input for reference';

-- Create index on scheduled_at and status for scheduler performance
CREATE INDEX IF NOT EXISTS idx_posts_scheduler 
ON posts (status, scheduled_at) 
WHERE status = 'SCHEDULED';

-- Create index on user_timezone for timezone-based queries
CREATE INDEX IF NOT EXISTS idx_posts_user_timezone 
ON posts (user_timezone) 
WHERE user_timezone IS NOT NULL;