-- ============================================================
-- Phase 2: Growth 대시보드 - 주간 에너지 통계 & AI 리포트 캐싱
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-20
-- ============================================================

-- ----------------------------------------------------------------
-- 1. weekly_energy_stats: 레이더 차트용 주간 카테고리 점수 캐싱
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_energy_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start    date NOT NULL,           -- 해당 주의 월요일 (ISO 기준)
  body_score    numeric(5,2) DEFAULT 0,  -- Body 카테고리 주간 완료율 (0~100)
  mind_score    numeric(5,2) DEFAULT 0,  -- Mind 카테고리 주간 완료율
  growth_score  numeric(5,2) DEFAULT 0,  -- Growth 카테고리 주간 완료율
  funplay_score numeric(5,2) DEFAULT 0,  -- FunPlay 카테고리 주간 완료율
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT uq_weekly_energy UNIQUE (user_id, week_start)
);

COMMENT ON TABLE public.weekly_energy_stats IS '레이더 차트용 주간 카테고리별 완료율 캐시';
COMMENT ON COLUMN public.weekly_energy_stats.week_start IS 'ISO 기준 해당 주의 월요일 날짜';

-- ----------------------------------------------------------------
-- 2. ai_weekly_reports: AI 주간 바이브 리포트 캐싱 (API 중복 호출 방지)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_weekly_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  report_text text NOT NULL,             -- AI 생성 주간 인사이트 텍스트
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_ai_weekly_report UNIQUE (user_id, week_start)
);

COMMENT ON TABLE public.ai_weekly_reports IS 'AI 주간 바이브 리포트 캐시 (OpenAI API 중복 호출 방지)';

-- ----------------------------------------------------------------
-- 3. missions 테이블 컬럼 추가: XP 보상
-- ----------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS xp_reward integer DEFAULT 10;  -- 미션 완료 시 지급 XP (기본 10)

COMMENT ON COLUMN public.missions.xp_reward IS '미션 완료 시 지급되는 경험치(XP), 기본값 10';

-- ----------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_weekly_energy_user_week
  ON public.weekly_energy_stats(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_ai_reports_user_week
  ON public.ai_weekly_reports(user_id, week_start DESC);

-- ----------------------------------------------------------------
-- 5. RLS 활성화
-- ----------------------------------------------------------------
ALTER TABLE public.weekly_energy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_weekly_reports ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 6. RLS Policies - weekly_energy_stats
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own weekly energy stats"
  ON public.weekly_energy_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly energy stats"
  ON public.weekly_energy_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly energy stats"
  ON public.weekly_energy_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly energy stats"
  ON public.weekly_energy_stats FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. RLS Policies - ai_weekly_reports
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own ai weekly reports"
  ON public.ai_weekly_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai weekly reports"
  ON public.ai_weekly_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai weekly reports"
  ON public.ai_weekly_reports FOR UPDATE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 8. Grants
-- ----------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_energy_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_weekly_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_energy_stats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_weekly_reports TO service_role;
