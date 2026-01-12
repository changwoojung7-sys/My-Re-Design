-- Add coverage dates to payments table to track subscription periods
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS coverage_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS coverage_end_date timestamp with time zone;

-- Optional: Backfill existing records (approximated)
UPDATE public.payments 
SET 
    coverage_start_date = created_at,
    coverage_end_date = created_at + (duration_months || ' months')::interval
WHERE coverage_start_date IS NULL;
