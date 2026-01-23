-- Rename 'replay' to 'funplay' in database

-- 1. Drop existing constraint (if possible to know name, otherwise we might need to check it)
-- Note: User previously created 'user_goals_category_check'.
ALTER TABLE user_goals DROP CONSTRAINT IF EXISTS user_goals_category_check;

-- 2. Update Data in 'user_goals'
UPDATE user_goals 
SET category = 'funplay' 
WHERE category = 'replay';

-- 3. Update Data in 'missions'
UPDATE missions 
SET category = 'funplay' 
WHERE category = 'replay';

-- 4. Re-add Constraint with 'funplay'
ALTER TABLE user_goals
ADD CONSTRAINT user_goals_category_check 
CHECK (category IN ('body_wellness', 'growth_career', 'mind_connection', 'funplay'));
