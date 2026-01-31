-- Fixed: Manual Delete Sequence to handle non-cascading FK on profiles table

BEGIN;

-- 1. Identify the User ID
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'blackimssa@gmail.com';
  
  if v_user_id is not null then
      -- 2. Delete from Dependent Tables (if not set to CASCADE)
      -- 'profiles' is the main one blocking auth.users deletion
      -- 'missions', 'goals' etc. usually reference 'profiles' and should cascade from it.
      
      DELETE FROM public.profiles WHERE id = v_user_id;
      
      -- 3. Delete from auth.users
      DELETE FROM auth.users WHERE id = v_user_id;
      
      raise notice 'User % deleted successfully', 'blackimssa@gmail.com';
  else
      raise notice 'User % not found', 'blackimssa@gmail.com';
  end if;
end $$;

COMMIT;
