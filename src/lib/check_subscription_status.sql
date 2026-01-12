-- Query to inspect consistency between Subscriptions and Payments
-- This will show all subscriptions and their linked payments, 
-- specifically highlighting any mismatches or status details.

SELECT 
    p.user_id,
    u.email, -- Assuming you have a users table or profiles view, otherwise remove this join if not needed
    s.type as plan_type,
    s.target_id as plan_category,
    s.status as subscription_status,
    p.status as payment_status,
    p.cancelled_at as payment_cancelled_at,
    s.start_date,
    s.end_date
FROM public.subscriptions s
JOIN public.payments p ON s.user_id = p.user_id 
    AND s.start_date = p.coverage_start_date 
    AND s.end_date = p.coverage_end_date
LEFT JOIN auth.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;
