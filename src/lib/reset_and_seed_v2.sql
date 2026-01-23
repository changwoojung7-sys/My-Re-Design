-- WARNING: This script deletes ALL user data (Missions, Goals, Friendships).
-- It preserves User Accounts (auth.users) and Profiles (public.profiles).

-- 1. Truncate dependent tables first to avoid foreign key constraints
TRUNCATE TABLE goal_likes CASCADE;
TRUNCATE TABLE goal_comments CASCADE;
TRUNCATE TABLE friend_history_permissions CASCADE;
TRUNCATE TABLE missions CASCADE;

-- 2. Truncate main data tables
-- user_goals depends on nothing (except user), but missions depend on it (handled above)
TRUNCATE TABLE user_goals CASCADE;

-- 3. Subscriptions (Optional: If we want to reset subscriptions too)
-- User asked to "Reset all data except accounts". Subscriptions are data.
TRUNCATE TABLE subscriptions CASCADE;

-- Note: We do NOT truncate 'profiles' or 'auth.users'.
