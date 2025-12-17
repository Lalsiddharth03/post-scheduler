-- Migration: Create atomic publish_scheduled_posts function
-- This function provides atomic publishing with proper concurrency handling

CREATE OR REPLACE FUNCTION publish_scheduled_posts(current_time TIMESTAMP WITH TIME ZONE)
RETURNS TABLE(id UUID, scheduled_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    batch_size INTEGER := 100; -- Configurable batch size
BEGIN
    -- Update posts atomically and return the updated rows
    RETURN QUERY
    UPDATE posts 
    SET 
        status = 'PUBLISHED',
        published_at = current_time
    WHERE posts.id IN (
        SELECT posts.id 
        FROM posts 
        WHERE posts.status = 'SCHEDULED' 
        AND posts.scheduled_at <= current_time
        ORDER BY posts.scheduled_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED  -- Prevent race conditions
    )
    RETURNING posts.id, posts.scheduled_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for clarity
COMMENT ON FUNCTION publish_scheduled_posts(TIMESTAMP WITH TIME ZONE) IS 'Atomically publishes scheduled posts with concurrency protection';