-- Migration: Create timezone validation function
-- This migration adds a comprehensive timezone validation function

-- Create function to validate IANA timezone identifiers
CREATE OR REPLACE FUNCTION validate_timezone(tz_name TEXT)
RETURNS BOOLEAN AS $
DECLARE
    test_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Return true for UTC (always valid)
    IF tz_name = 'UTC' THEN
        RETURN TRUE;
    END IF;
    
    -- Return false for null or empty strings
    IF tz_name IS NULL OR tz_name = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Basic format check for IANA timezone (Area/Location)
    IF NOT (tz_name ~ '^[A-Za-z_]+/[A-Za-z_]+$') THEN
        RETURN FALSE;
    END IF;
    
    -- Try to use the timezone in a conversion to validate it exists
    BEGIN
        test_timestamp := NOW() AT TIME ZONE tz_name;
        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for the function
COMMENT ON FUNCTION validate_timezone(TEXT) IS 'Validates IANA timezone identifiers by attempting timezone conversion';

-- Create function to get current UTC timestamp as string
CREATE OR REPLACE FUNCTION get_current_utc()
RETURNS TEXT AS $
BEGIN
    RETURN (NOW() AT TIME ZONE 'UTC')::TEXT;
END;
$ LANGUAGE plpgsql STABLE;

-- Add comment for the function
COMMENT ON FUNCTION get_current_utc() IS 'Returns current UTC timestamp as text for consistent formatting';

-- Create function to convert timezone safely with fallback to UTC
CREATE OR REPLACE FUNCTION safe_timezone_convert(
    input_time TIMESTAMP WITH TIME ZONE,
    target_timezone TEXT
)
RETURNS TIMESTAMP WITH TIME ZONE AS $
BEGIN
    -- Validate timezone first
    IF NOT validate_timezone(target_timezone) THEN
        -- Log the invalid timezone attempt (in a real system, you'd use proper logging)
        RAISE NOTICE 'Invalid timezone %, falling back to UTC', target_timezone;
        RETURN input_time AT TIME ZONE 'UTC';
    END IF;
    
    -- Perform the conversion
    RETURN input_time AT TIME ZONE target_timezone;
EXCEPTION WHEN OTHERS THEN
    -- Fallback to UTC on any error
    RAISE NOTICE 'Timezone conversion failed for %, falling back to UTC', target_timezone;
    RETURN input_time AT TIME ZONE 'UTC';
END;
$ LANGUAGE plpgsql STABLE;

-- Add comment for the function
COMMENT ON FUNCTION safe_timezone_convert(TIMESTAMP WITH TIME ZONE, TEXT) IS 'Safely converts timestamps to target timezone with UTC fallback';

-- Update the timezone constraints to use the validation function
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS chk_posts_timezone_format,
ADD CONSTRAINT chk_posts_timezone_valid 
CHECK (user_timezone IS NULL OR validate_timezone(user_timezone));

ALTER TABLE user_preferences 
DROP CONSTRAINT IF EXISTS chk_user_preferences_timezone_format,
ADD CONSTRAINT chk_user_preferences_timezone_valid 
CHECK (validate_timezone(timezone));

-- Add comments for updated constraints
COMMENT ON CONSTRAINT chk_posts_timezone_valid ON posts IS 'Validates timezone using comprehensive timezone validation function';
COMMENT ON CONSTRAINT chk_user_preferences_timezone_valid ON user_preferences IS 'Validates timezone using comprehensive timezone validation function';