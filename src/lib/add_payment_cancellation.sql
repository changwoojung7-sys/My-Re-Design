-- Add cancelled_at column to payments to track cancellations
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- Ensure RLS allows users to update their own payments (for cancellation)
-- Currently likely only insert/select. Need update policy.
CREATE POLICY "Users can update own payments" ON public.payments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin policy (if not exists)
-- Assuming admins have bypass or specific role, but for now we might rely on service role or specific admin policy.
-- If 'admin_settings' table check is used:
-- (This part depends on how Admin auth is handled, often just checking email or a role table)
