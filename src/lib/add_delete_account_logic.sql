-- Create Deleted Users Archive Table
create table if not exists public.deleted_users (
    id uuid default gen_random_uuid() primary key,
    original_user_id uuid, -- Keep the string or uuid, but auth.users id is uuid
    email text,
    nickname text,
    subscription_history jsonb,
    payment_history jsonb,
    deleted_at timestamptz default now()
);

-- RLS for deleted_users
alter table public.deleted_users enable row level security;

-- Allow read access for anyone (authenticated) to support Admin view
create policy "Enable read access for all users"
on public.deleted_users for select
using (true);

-- Function to handle account deletion
create or replace function public.delete_account()
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid;
    v_email text;
    v_nickname text;
    v_subs jsonb;
    v_pays jsonb;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- 1. Gather Data for Backup
    select email into v_email from auth.users where id = v_user_id;
    select nickname into v_nickname from public.profiles where id = v_user_id;
    
    select jsonb_agg(to_jsonb(s)) into v_subs 
    from public.subscriptions s 
    where s.user_id = v_user_id;

    select jsonb_agg(to_jsonb(p)) into v_pays 
    from public.payments p 
    where p.user_id = v_user_id;

    -- 2. Insert into Archive
    insert into public.deleted_users (original_user_id, email, nickname, subscription_history, payment_history)
    values (v_user_id, v_email, v_nickname, coalesce(v_subs, '[]'::jsonb), coalesce(v_pays, '[]'::jsonb));

    -- 3. Explicitly Delete Dependent Data (To avoid Foreign Key Constraints if Cascade is missing)
    -- We delete most granular children first
    
    -- 3.1 Social Interactions (Likes/Comments made BY user)
    delete from public.goal_likes where user_id = v_user_id;
    delete from public.goal_comments where user_id = v_user_id;
    
    -- 3.2 Permissions (Requests BY user)
    -- Note: We also need to delete permissions linked to USER'S goals, but we'll do that by ID list below or just rely on manual deletion if needed.
    -- Let's delete where requester is user.
    delete from public.friend_history_permissions where requester_id = v_user_id;
    
    -- 3.3 Delete interactions ON user's goals (Likes/Comments/Permissions targeting user's goals)
    -- This requires selecting goal IDs first or using subquery
    delete from public.goal_likes where goal_id in (select id from public.user_goals where user_id = v_user_id);
    delete from public.goal_comments where goal_id in (select id from public.user_goals where user_id = v_user_id);
    delete from public.friend_history_permissions where goal_id in (select id from public.user_goals where user_id = v_user_id);

    -- 3.4 Missions
    delete from public.missions where user_id = v_user_id;

    -- 3.5 Goals
    delete from public.user_goals where user_id = v_user_id;

    -- 3.6 Friends
    delete from public.friends where user_id = v_user_id or friend_id = v_user_id;
    
    -- 3.7 Subscriptions & Payments (We already backed them up)
    delete from public.subscriptions where user_id = v_user_id;
    delete from public.payments where user_id = v_user_id;

    -- 4. Delete Profile
    delete from public.profiles where id = v_user_id;

    -- 5. Delete Auth User
    delete from auth.users where id = v_user_id;
    
exception
    when others then
        -- If something breaks, raise it so client knows
        raise;
end;
$$;
