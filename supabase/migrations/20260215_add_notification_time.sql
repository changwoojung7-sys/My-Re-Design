-- Add notification_time column to profiles table
-- Usage: Run this in Supabase Dashboard -> SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_time VARCHAR(5); -- Stores time in HH:mm format

COMMENT ON COLUMN profiles.notification_time IS 'Daily notification time in HH:mm format';
