-- Add reasoning and trust_score columns to missions table
-- Note: 'reasoning' is a JSONB column to store flexible data (user_context, scientific_basis, etc.)
-- 'trust_score' is an integer (0-100)

ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS reasoning JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- Comment on columns for clarity
COMMENT ON COLUMN missions.reasoning IS 'Stores AI reasoning: user_context, scientific_basis, expected_impact';
COMMENT ON COLUMN missions.trust_score IS 'AI recommendation confidence score (0-100)';
COMMENT ON COLUMN missions.details IS 'Flexible extra details (e.g. Re:Play difficulty, mood, place)';
