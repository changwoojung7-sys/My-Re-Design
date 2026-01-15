-- RPC: Securely search for a user by Email or Phone
-- This function allows finding a user for Friend Request purposes.
-- It bypasses the RLS on auth.users (by being security definer) but only returns safe public info.

create or replace function public.search_user_by_email_or_phone(
  search_term text
)
returns table (
  id uuid,
  email text,
  nickname text,
  profile_image_url text
)
language plpgsql
security definer
as $$
declare
  clean_term text;
  possible_phone text;
begin
  -- Clean search term for phone logic
  clean_term := regexp_replace(search_term, '[^0-9]', '', 'g');
  
  -- Logic:
  -- 1. Exact Email Match (case insensitive)
  -- 2. Phone Match (try to match input, or formatted input)
  --    Note: auth.users.phone usually stores E.164 (e.g., +821012345678)
  
  return query
  select 
    au.id, 
    au.email::text, 
    coalesce(p.nickname, split_part(au.email, '@', 1)) as nickname, 
    p.profile_image_url
  from auth.users au
  left join public.profiles p on p.id = au.id
  where 
    -- Email Match
    (lower(au.email) = lower(search_term))
    OR
    -- Phone Match (if input looks like phone digits)
    (
      length(clean_term) >= 8 and (
         au.phone = search_term
         or au.phone = '+' || search_term
         or au.phone like '%' || clean_term -- Loose match for last digits
         -- Support the legacy/custom phone-email formats from Friends.tsx
         or au.email = clean_term || '@myredesign.com'
         or au.email = clean_term || '@phone.coreloop.com'
      )
    )
    OR
    -- Search by nickname (optional, but requested "phone and email") -> user prompt says "phone and email", so maybe not nickname.
    -- But Friends.tsx was only email/phone. Let's stick to email/phone to avoid leaking users by random name guesses.
    false
  limit 1;
end;
$$;
