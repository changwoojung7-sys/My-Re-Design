-- Migration: support 'funplay' category and migrate old 'replay' data

-- 1. Update user_goals table
-- First, drop the old constraint
ALTER TABLE user_goals DROP CONSTRAINT IF EXISTS user_goals_category_check;

-- Update any existing 'replay' data to 'funplay' (if you have any)
UPDATE user_goals SET category = 'funplay' WHERE category = 'replay';

-- Add the new constraint including 'funplay'
ALTER TABLE user_goals 
ADD CONSTRAINT user_goals_category_check 
CHECK (category IN ('body_wellness', 'growth_career', 'mind_connection', 'funplay'));


-- 2. Update missions table
-- Drop old constraint
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_category_check;

-- Update existing data
UPDATE missions SET category = 'funplay' WHERE category = 'replay';

-- Add new constraint
ALTER TABLE missions 
ADD CONSTRAINT missions_category_check 
CHECK (category IN ('body_wellness', 'growth_career', 'mind_connection', 'funplay'));
