-- Create Subscriptions Table
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('mission', 'all')) not null,
  target_id text, -- 'health', 'growth', etc. for type='mission', or null for type='all'
  start_date timestamptz default now() not null,
  end_date timestamptz not null,
  status text check (status in ('active', 'expired', 'cancelled')) default 'active',
  created_at timestamptz default now()
);

-- Create Payments Table
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null,
  plan_type text not null, -- 'mission_1mo', 'all_1yr', etc.
  duration_months int not null,
  target_id text, -- Category for mission plans
  status text default 'completed',
  created_at timestamptz default now()
);

-- Add helper to check active subscription
-- (Optional function, but logic will mainly be handled in app for now)

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Policies
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can view own payments" on public.payments
  for select using (auth.uid() = user_id);

-- Depending on app logic, you might need insert policies if client-side insertion is used (mock payment)
create policy "Users can insert own subscriptions" on public.subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Users can insert own payments" on public.payments
  for insert with check (auth.uid() = user_id);

-- Admin Settings Table (Global Config)
create table if not exists public.admin_settings (
  key text primary key,
  value text
);

-- Seed initial paywall setting (default 5th day, meaning free up to day 4)
insert into public.admin_settings (key, value)
values ('paywall_start_day', '5')
on conflict (key) do nothing;

-- Add custom free trial override to profiles
alter table public.profiles 
add column if not exists custom_free_trial_days int;

-- RLS for Admin Settings
alter table public.admin_settings enable row level security;

create policy "Enable read access for all users"
on public.admin_settings for select
using (true);

create policy "Enable all access for service role or admin logic"
on public.admin_settings for all
using (true);

