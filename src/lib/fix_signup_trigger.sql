-- FINAL FIX: Correct Column Names based on User Schema
-- Schema: email, nickname, full_name, phone_number (NOT phone)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (
    id, 
    email, 
    full_name, 
    nickname, 
    phone_number, -- Valid column name
    created_at, 
    updated_at
  )
  values (
    new.id,
    new.email,
    -- Extract full_name
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    -- Extract nickname
    coalesce(new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- Extract phone_number (Prioritize auth phone, then metadata)
    -- Use distinct name to recognize it comes from phone logic
    coalesce(new.phone, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number'),
    new.created_at,
    new.created_at
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone_number = excluded.phone_number,
    updated_at = now();
    
  return new;
end;
$$;

-- Ensure Trigger is Bound
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
