-- Migration: Create user_preferences table
-- This table stores user timezone preferences

CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for clarity
COMMENT ON TABLE user_preferences IS 'User timezone preferences and settings';
COMMENT ON COLUMN user_preferences.timezone IS 'IANA timezone identifier (e.g., America/New_York)';

-- Create index on timezone for analytics
CREATE INDEX idx_user_preferences_timezone ON user_preferences (timezone);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();