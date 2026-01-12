-- 1. Ensure RLS is enabled for missions
alter table public.missions enable row level security;

-- 2. Drop existing delete policy if any (to update it)
drop policy if exists "Users can delete own missions" on public.missions;

-- 3. Create explicit DELETE policy
-- This allows a user to delete a row in 'missions' only if their auth.uid matches the row's user_id.
create policy "Users can delete own missions"
on public.missions for delete
using (auth.uid() = user_id);

-- 4. Do the same for user_goals just in case
alter table public.user_goals enable row level security;
drop policy if exists "Users can delete own goals" on public.user_goals;

create policy "Users can delete own goals"
on public.user_goals for delete
using (auth.uid() = user_id);
