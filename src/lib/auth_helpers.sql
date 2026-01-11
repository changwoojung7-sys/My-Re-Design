-- Helper to check if email or phone already exists
-- Returns: { email_exists: boolean, phone_exists: boolean }
create or replace function public.check_duplicate_user(
  email_input text,
  phone_input text
)
returns json
language plpgsql
security definer -- Access to auth.users
as $$
declare
  email_found boolean;
  phone_found boolean;
  email_zombie boolean := false;
  phone_zombie boolean := false;
  v_user_id uuid;
begin
  -- 1. Check Email
  select id into v_user_id from auth.users where email = email_input;
  if v_user_id is not null then
    email_found := true;
    -- Check if profile exists
    if not exists (select 1 from public.profiles where id = v_user_id) then
        email_zombie := true;
    end if;
  else
    email_found := false;
  end if;
  
  -- 2. Check Phone
  -- Use a separate variable to check phone ownership
  v_user_id := null;
  select id into v_user_id from auth.users where phone = phone_input;
  if v_user_id is not null then
    phone_found := true;
     -- Check if profile exists
    if not exists (select 1 from public.profiles where id = v_user_id) then
        phone_zombie := true;
    end if;
  else
    phone_found := false;
  end if;

  return json_build_object(
    'email_exists', email_found,
    'phone_exists', phone_found,
    'email_is_zombie', email_zombie,
    'phone_is_zombie', phone_zombie
  );
end;
$$;

-- Helper to get Email by Phone (for Login)
create or replace function public.get_email_by_phone(
  phone_input text
)
returns text
language plpgsql
security definer
as $$
declare
  found_email text;
begin
  select email into found_email
  from auth.users
  where phone = phone_input
  limit 1;
  
  return found_email;
end;
$$;

-- Helper to clean zombie users (Auth exists, Profile missing)
-- This allows re-registration if deletion failed halfway
create or replace function public.clean_zombie_user(
  target_email text default null,
  target_phone text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  if target_email is not null then
      select id into v_user_id from auth.users where email = target_email;
      if v_user_id is not null and not exists (select 1 from public.profiles where id = v_user_id) then
          delete from auth.users where id = v_user_id;
      end if;
  end if;

  if target_phone is not null then
      select id into v_user_id from auth.users where phone = target_phone;
      if v_user_id is not null and not exists (select 1 from public.profiles where id = v_user_id) then
          delete from auth.users where id = v_user_id;
      end if;
  end if;
end;
$$;
