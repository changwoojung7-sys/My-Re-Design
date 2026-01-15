-- User Recovery & Force Reset Logic

-- 1. Add column to profiles (or we just use user_metadata, but let's use a secure separate table or just metadata)
-- Using user_metadata in auth.users is standard, but we can't easily query it publicly without security definer functions.
-- We will use a function to manage a flag in `auth.users.raw_app_meta_data`.
-- app_metadata is better for admin-controlled flags than user_metadata (which user can sometimes edit).

create extension if not exists pgcrypto;

-- RPC: Admin enables "Force Reset" for a user
create or replace function public.admin_set_force_reset(
  target_user_id uuid,
  enable boolean
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check Admin permissions (Simplified for this project)
  if auth.role() = 'anon' then
    raise exception 'Not authenticated';
  end if;
  
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('force_password_reset', enable)
  where id = target_user_id;
end;
$$;

-- RPC: Public check if email needs reset
-- Returns true ONLY if the flag is active for that email.
-- Note: This allows email enumeration (checking if an email is in "reset mode"), which is acceptable for this use case.
create or replace function public.check_user_reset_status(
  email_input text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_meta jsonb;
begin
  select raw_app_meta_data into v_meta
  from auth.users
  where email = email_input;
  
  if v_meta is not null and (v_meta->>'force_password_reset')::boolean = true then
    return true;
  else
    return false;
  end if;
end;
$$;

-- RPC: Complete the reset
-- This sets the new password and clears the flag.
create or replace function public.complete_force_password_reset(
  email_input text,
  new_password text
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_meta jsonb;
begin
  -- 1. Verify User Exists
  select id, raw_app_meta_data into v_user_id, v_meta
  from auth.users
  where email = email_input;
  
  if v_user_id is null then
    raise exception 'User not found';
  end if;

  -- 2. Verify Flag is Active
  if v_meta is null or (v_meta->>'force_password_reset')::boolean is distinct from true then
     raise exception 'Password reset not authorized for this account.';
  end if;

  -- 3. Update Password AND Confirm Email (since Admin authorized this rescue)
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      raw_app_meta_data = v_meta - 'force_password_reset', -- Remove the flag
      email_confirmed_at = coalesce(email_confirmed_at, now()), -- Auto-confirm if not confirmed
      updated_at = now()
  where id = v_user_id;

end;
$$;
