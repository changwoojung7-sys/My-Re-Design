-- Create friend_groups table
create table if not exists public.friend_groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- Create friend_group_members table
create table if not exists public.friend_group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.friend_groups(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null, -- The friend's user_id
  created_at timestamptz default now(),
  unique(group_id, member_id)
);

-- Enable RLS
alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;

-- Policies for friend_groups
create policy "Users can view own groups" on public.friend_groups
  for select using (auth.uid() = user_id);

create policy "Users can insert own groups" on public.friend_groups
  for insert with check (auth.uid() = user_id);

create policy "Users can update own groups" on public.friend_groups
  for update using (auth.uid() = user_id);

create policy "Users can delete own groups" on public.friend_groups
  for delete using (auth.uid() = user_id);

-- Policies for friend_group_members
create policy "Users can view members of own groups" on public.friend_group_members
  for select using (
    exists (
      select 1 from public.friend_groups
      where id = friend_group_members.group_id
      and user_id = auth.uid()
    )
  );

create policy "Users can add members to own groups" on public.friend_group_members
  for insert with check (
    exists (
      select 1 from public.friend_groups
      where id = friend_group_members.group_id
      and user_id = auth.uid()
    )
  );

create policy "Users can delete members from own groups" on public.friend_group_members
  for delete using (
    exists (
      select 1 from public.friend_groups
      where id = friend_group_members.group_id
      and user_id = auth.uid()
    )
  );
