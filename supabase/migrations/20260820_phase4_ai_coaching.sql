-- ============================================================
-- Phase 4: AI 코칭 2.0 - 회고 챗 + 컨디션 반응형 미션
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-20
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ai_reflections: AI 회고 챗봇 대화 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_reflections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_date date NOT NULL,           -- 회고 날짜
  question     text NOT NULL,           -- AI가 던진 질문
  answer       text,                    -- 유저의 답변 (nullable - 아직 미답 상태)
  ai_response  text,                    -- 유저 답변에 대한 AI 코멘트
  created_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ai_reflections IS 'AI 회고 챗봇 대화 기록 (하루 미션 완료 후 회고 질문/답변)';

-- ----------------------------------------------------------------
-- 2. user_goals 테이블 컬럼 추가: 난이도 설정
-- ----------------------------------------------------------------
ALTER TABLE public.user_goals
  ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'normal'
    CHECK (difficulty_level IN ('easy', 'normal', 'hard'));

COMMENT ON COLUMN public.user_goals.difficulty_level IS 'AI 미션 생성 시 선호 난이도 (easy/normal/hard)';

-- ----------------------------------------------------------------
-- 3. missions 테이블 컬럼 추가: 컨디션 반응형 조절 이력
-- ----------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS condition_at_time   smallint,   -- 미션 생성 시점 유저 컨디션 (1~5)
  ADD COLUMN IF NOT EXISTS difficulty_adjusted boolean DEFAULT false; -- 컨디션 기반 난이도 조절 여부

COMMENT ON COLUMN public.missions.condition_at_time IS '미션 생성 시 기록된 유저 컨디션 (1=매우낮음~5=최고)';
COMMENT ON COLUMN public.missions.difficulty_adjusted IS '컨디션에 따라 AI가 난이도를 조절했는지 여부';

-- ----------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_reflections_user_date
  ON public.ai_reflections(user_id, mission_date DESC);

-- ----------------------------------------------------------------
-- 5. RLS 활성화
-- ----------------------------------------------------------------
ALTER TABLE public.ai_reflections ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 6. RLS Policies - ai_reflections
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own reflections"
  ON public.ai_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections"
  ON public.ai_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections"
  ON public.ai_reflections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflections"
  ON public.ai_reflections FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. Grants
-- ----------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reflections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reflections TO service_role;
