-- ============================================================
-- Phase 3: 게이미피케이션 - XP / 레벨 / 뱃지 / 트로피 룸
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-20
-- ============================================================

-- ----------------------------------------------------------------
-- 1. profiles 테이블 컬럼 추가: XP / 레벨 / 컨디션
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_xp        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level   integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS level_title     text    DEFAULT '비기너',
  ADD COLUMN IF NOT EXISTS condition_today smallint DEFAULT 3;  -- 오늘 컨디션 (1~5)

COMMENT ON COLUMN public.profiles.total_xp IS '누적 경험치(XP) 합계';
COMMENT ON COLUMN public.profiles.current_level IS '현재 유저 레벨 (1~)';
COMMENT ON COLUMN public.profiles.level_title IS '현재 레벨 타이틀 (비기너, 루틴 탐험가, ...)';
COMMENT ON COLUMN public.profiles.condition_today IS '오늘의 컨디션 1(최악)~5(최고), AI 미션 난이도 조절에 활용';

-- ----------------------------------------------------------------
-- 2. badges: 뱃지 마스터 정의 테이블
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,     -- 'early_bird', 'mind_master' 등 (코드 참조용)
  name        text NOT NULL,            -- 뱃지 표시 이름
  emoji       text NOT NULL,            -- 대표 이모지
  description text,                     -- 획득 조건 설명
  condition   jsonb,                    -- 조건 메타데이터 (type, threshold 등)
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.badges IS '뱃지 마스터 정의 테이블 (관리자가 추가)';

-- ----------------------------------------------------------------
-- 3. user_badges: 유저별 획득 뱃지 기록
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS '유저별 획득 뱃지 기록';

-- ----------------------------------------------------------------
-- 4. xp_logs: XP 획득 내역 로그
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xp_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     integer NOT NULL,          -- 획득 XP (양수: 지급, 음수: 차감)
  reason     text,                      -- 'mission_complete', 'streak_bonus', 'badge_bonus' 등
  ref_id     uuid,                      -- 관련 mission/goal id (nullable)
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.xp_logs IS 'XP 획득/차감 내역 로그';

-- ----------------------------------------------------------------
-- 5. 기본 뱃지 데이터 삽입
-- ----------------------------------------------------------------
INSERT INTO public.badges (key, name, emoji, description, condition) VALUES
  ('early_bird',    '얼리버드',      '🏃', '오전 7시 이전 미션 완료 7회',       '{"type": "early_complete", "threshold": 7, "before_hour": 7}'),
  ('mind_master',   '마인드마스터',  '🧘', 'Mind 카테고리 미션 30개 달성',       '{"type": "category_count", "category": "mind_connection", "threshold": 30}'),
  ('flame_runner',  '불꽃런너',      '🔥', '14일 연속 스트릭 달성',              '{"type": "streak", "threshold": 14}'),
  ('perfect_week',  '퍼펙트위크',    '🎯', '1주 동안 모든 미션 100% 완료',       '{"type": "perfect_week", "threshold": 1}'),
  ('body_warrior',  '바디워리어',    '💪', 'Body 카테고리 미션 30개 달성',       '{"type": "category_count", "category": "body_wellness", "threshold": 30}'),
  ('growth_master', '그로스마스터',  '🚀', 'Growth 카테고리 미션 30개 달성',     '{"type": "category_count", "category": "growth_career", "threshold": 30}'),
  ('fun_player',    '펀플레이어',    '🎮', 'FunPlay 카테고리 미션 20개 달성',    '{"type": "category_count", "category": "funplay", "threshold": 20}'),
  ('centurion',     '센추리온',      '🏆', '미션 100개 총 완료',                  '{"type": "total_missions", "threshold": 100}'),
  ('life_king',     '라이프킹',      '👑', 'Lv.20 달성',                         '{"type": "level", "threshold": 20}'),
  ('socialite',     '소셜라이트',    '👥', '친구 5명 이상 추가',                  '{"type": "friends_count", "threshold": 5}')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- 6. Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON public.user_badges(user_id);

CREATE INDEX IF NOT EXISTS idx_xp_logs_user_date
  ON public.xp_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_badges_key
  ON public.badges(key);

-- ----------------------------------------------------------------
-- 7. RLS 활성화
-- ----------------------------------------------------------------
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 8. RLS Policies - badges (공개 읽기)
-- ----------------------------------------------------------------
CREATE POLICY "Anyone can read badges"
  ON public.badges FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage badges"
  ON public.badges FOR ALL
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- 9. RLS Policies - user_badges
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert user badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 10. RLS Policies - xp_logs
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own xp logs"
  ON public.xp_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert xp logs"
  ON public.xp_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 11. Grants
-- ----------------------------------------------------------------
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.badges TO service_role;

GRANT SELECT ON public.user_badges TO authenticated;
GRANT INSERT, UPDATE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

GRANT SELECT ON public.xp_logs TO authenticated;
GRANT INSERT ON public.xp_logs TO authenticated;
GRANT ALL ON public.xp_logs TO service_role;
