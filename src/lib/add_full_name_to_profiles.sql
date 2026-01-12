-- Add full_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Optional: Update RLS policies if needed, but usually update policies cover all columns or are row-based.
-- If you have specific column security, you might need to adjust.
-- For now, we assume authenticated users can read/update their own profile's full_name.
