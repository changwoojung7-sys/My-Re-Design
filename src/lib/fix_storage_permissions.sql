-- 1. Create 'mission-proofs' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('mission-proofs', 'mission-proofs', true)
on conflict (id) do nothing;

-- 2. Drop existing policies for storage.objects to avoid conflicts
drop policy if exists "Mission Proofs Public Access" on storage.objects;
drop policy if exists "Users can upload own mission proofs" on storage.objects;
drop policy if exists "Users can update own mission proofs" on storage.objects;
drop policy if exists "Users can delete own mission proofs" on storage.objects;
drop policy if exists "Give users access to own folder" on storage.objects;

-- 3. Create comprehensive policies
-- Allow public read access to the bucket (since it's a public bucket)
create policy "Mission Proofs Public Access"
on storage.objects for select
using ( bucket_id = 'mission-proofs' );

-- Allow authenticated users to upload to their own folder (userId/filename)
create policy "Users can upload own mission proofs"
on storage.objects for insert
with check (
  bucket_id = 'mission-proofs' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
create policy "Users can update own mission proofs"
on storage.objects for update
using (
  bucket_id = 'mission-proofs' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
create policy "Users can delete own mission proofs"
on storage.objects for delete
using (
  bucket_id = 'mission-proofs' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Verify Missions Table RLS (just in case)
alter table public.missions enable row level security;

-- Ensure Update policy exists
drop policy if exists "Users can update own missions" on public.missions;
create policy "Users can update own missions"
on public.missions for update
using (auth.uid() = user_id);

-- Ensure Insert policy exists
drop policy if exists "Users can insert own missions" on public.missions;
create policy "Users can insert own missions"
on public.missions for insert
with check (auth.uid() = user_id);
