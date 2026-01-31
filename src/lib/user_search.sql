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
  -- 2. Phone Match (fuzzy)
  
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
      length(clean_term) >= 4 and (
         au.phone like '%' || clean_term || '%' -- Fuzzy match (contains)
         or 
         -- Check if they stored it without +82 locally? usually auth.users is strict.
         -- But maybe clean_term matches without country code?
         -- Let's just do simple LIKE on the digits we cleaned? 
         -- Actually au.phone has +82... so cleaning au.phone might be expensive.
         -- Just relying on LIKE is simplest for now.
         au.phone like '%' || search_term || '%' 
         -- Also search in metadata (for email signups who added phone)
         or
         au.raw_user_meta_data->>'phone' like '%' || clean_term || '%'
         or
         au.raw_user_meta_data->>'phone_number' like '%' || clean_term || '%'
         or
         au.raw_user_meta_data->>'phone' like '%' || search_term || '%'
      )
    )
    OR
    -- Nickname Match
    (p.nickname is not null and p.nickname ilike '%' || search_term || '%')
  limit 20; -- Return up to 20 matches instead of 1
end;
$$;
