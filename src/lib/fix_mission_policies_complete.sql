-- Enable RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'missions'
-- Drop existing policies to avoid conflicts (Safe Reset)
DROP POLICY IF EXISTS "Users can view own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can insert own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can delete own missions" ON public.missions;

-- Create Policies
CREATE POLICY "Users can view own missions"
ON public.missions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
ON public.missions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
ON public.missions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions"
ON public.missions FOR DELETE
USING (auth.uid() = user_id);


-- 2. Policies for 'user_goals'
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.user_goals;

-- Create Policies
CREATE POLICY "Users can view own goals"
ON public.user_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
ON public.user_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
ON public.user_goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
ON public.user_goals FOR DELETE
USING (auth.uid() = user_id);
