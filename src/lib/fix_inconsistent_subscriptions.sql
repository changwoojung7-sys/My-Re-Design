-- Fix subscriptions that remain active despite payment cancellation
-- This query finds subscriptions that are 'active' but have a matching payment that is 'cancelled'.
-- Match is determined by user_id and exact start/end dates.

UPDATE public.subscriptions s
SET status = 'cancelled'
FROM public.payments p
WHERE s.user_id = p.user_id 
  AND s.start_date = p.coverage_start_date 
  AND s.end_date = p.coverage_end_date
  AND p.status = 'cancelled'
  AND s.status = 'active';

-- Optional: You can check which ones will be updated first with:
/*
SELECT s.* 
FROM public.subscriptions s
JOIN public.payments p ON s.user_id = p.user_id 
    AND s.start_date = p.coverage_start_date 
    AND s.end_date = p.coverage_end_date
WHERE p.status = 'cancelled' AND s.status = 'active';
*/
