-- Check if friends table exists and its policies
select * from pg_policies where tablename = 'friends';

-- Check if friend_history_permissions table exists and its policies
select * from pg_policies where tablename = 'friend_history_permissions';

-- Check current friends for Grangge
select * from public.friends 
where user_id = (select id from public.profiles where email = 'calamus7@naver.com')
   or friend_id = (select id from public.profiles where email = 'calamus7@naver.com');

-- Check profiles to find ID for Grangge
select id, email, nickname from public.profiles where email = 'calamus7@naver.com';
