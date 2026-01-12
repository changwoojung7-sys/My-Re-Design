-- Comprehensive Social Access Policies
-- This script ensures that all users can READ social data (Profiles, Goals, Missions) 
-- necessary for the Friends tab to function correctly.

-- 1. PROFILES: Allow everyone to read profiles (needed to search and view friends)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- 2. USER GOALS: Allow everyone (or authenticated) to read goals
-- If this was restricted to "own only", friends could not see your goals.
DROP POLICY IF EXISTS "Goals are viewable by everyone" ON public.user_goals;
CREATE POLICY "Goals are viewable by everyone" 
ON public.user_goals FOR SELECT USING (true);

-- 3. MISSIONS: Allow everyone to read missions (needed for calculating friend success rate stats)
DROP POLICY IF EXISTS "Missions are viewable by everyone" ON public.missions;
CREATE POLICY "Missions are viewable by everyone" 
ON public.missions FOR SELECT USING (true);

-- 4. GOAL LIKES & COMMENTS
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.goal_likes;
CREATE POLICY "Likes are viewable by everyone" 
ON public.goal_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.goal_comments;
CREATE POLICY "Comments are viewable by everyone" 
ON public.goal_comments FOR SELECT USING (true);

-- 5. FRIENDS: Ensure viewing is allowed (Re-applying for safety)
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
CREATE POLICY "Users can view their own friendships" 
ON public.friends FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);
