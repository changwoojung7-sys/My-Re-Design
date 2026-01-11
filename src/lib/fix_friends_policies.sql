-- Enable RLS
alter table public.friends enable row level security;
alter table public.friend_history_permissions enable row level security;

-- Friends Policies
create policy "Users can view their own friendships"
on public.friends for select
using (auth.uid() = user_id OR auth.uid() = friend_id);

create policy "Users can insert their own friendships"
on public.friends for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own friendships"
on public.friends for delete
using (auth.uid() = user_id OR auth.uid() = friend_id);

-- Friend History Permissions Policies
create policy "Users can view permissions involving them"
on public.friend_history_permissions for select
using (auth.uid() = requester_id OR auth.uid() = target_user_id);

create policy "Users can insert permissions as requester"
on public.friend_history_permissions for insert
with check (auth.uid() = requester_id);

create policy "Users can update permissions involving them"
on public.friend_history_permissions for update
using (auth.uid() = requester_id OR auth.uid() = target_user_id);
