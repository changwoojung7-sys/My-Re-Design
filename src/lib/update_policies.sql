-- Allow reading all subscriptions for everyone (for Admin MVP)
-- WARN: In production, use a role-based check e.g. (auth.role() = 'service_role' OR exists(select 1 from admins where id = auth.uid()))

create policy "Enable read access for all users on subscriptions"
on public.subscriptions for select
using (true);

-- Also allow reading payments if needed
create policy "Enable read access for all users on payments"
on public.payments for select
using (true);
