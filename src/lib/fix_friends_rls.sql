-- Enable RLS on friends table
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Policy to view friends
-- Users can see friendship rows where they are either the user or the friend
CREATE POLICY "Users can view their own friendships" 
ON public.friends 
FOR SELECT 
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- Policy to add friends
-- Users can insert rows where they are the initiator (user_id)
CREATE POLICY "Users can add friends" 
ON public.friends 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
);

-- Policy to update friends (e.g. status)
CREATE POLICY "Users can update their friendships" 
ON public.friends 
FOR UPDATE 
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- Policy to delete friends
CREATE POLICY "Users can delete their friendships" 
ON public.friends 
FOR DELETE 
USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- Ensure profiles are publicly readable (or at least readable by authenticated users)
-- This is often key for social features
-- Drop existing potential restrictive policy first just in case, or just add a broad one if not exists.
-- But usually profiles are public. Let's make sure.
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);
