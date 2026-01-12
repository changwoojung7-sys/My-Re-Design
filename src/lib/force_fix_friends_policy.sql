-- Drop all existing policies on friends table to start fresh and avoid conflicts
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can add friends" ON public.friends;
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friends;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.friends;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.friends;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.friends;

-- Enable RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 1. VIEW: Users can see rows where they are involved
CREATE POLICY "Users can view their own friendships" 
ON public.friends FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 2. INSERT: Users can create a friendship if they are the 'user_id' (initiator)
CREATE POLICY "Users can add friends" 
ON public.friends FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE: Users can update status
CREATE POLICY "Users can update their friendships" 
ON public.friends FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 4. DELETE: Users can remove friends
CREATE POLICY "Users can delete their friendships" 
ON public.friends FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);
