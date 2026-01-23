-- Migration: Change duration_months to numeric to support weeks (0.25, 0.5)

ALTER TABLE user_goals 
ALTER COLUMN duration_months TYPE numeric(4, 2); -- Supports up to 99.99

-- Also check if missions table has similar constraints? 
-- Missions table usually refers to goals but doesn't store duration itself, usually.
-- Just in case, if you copy duration somewhere else, update it too.
