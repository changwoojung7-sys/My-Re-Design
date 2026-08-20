-- ============================================================
-- 버디 챌린지 전용 일일 인증 로그 테이블
-- missions 테이블과 완전히 분리된 독립 구조
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-21
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buddy_challenge_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_challenge_id  uuid NOT NULL REFERENCES public.buddy_challenges(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date            date NOT NULL,
  is_completed        boolean DEFAULT false,
  image_url           text,
  proof_text          text,
  proof_type          text DEFAULT 'image' CHECK (proof_type IN ('image', 'video', 'text', 'none')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT uq_buddy_log_per_day UNIQUE (buddy_challenge_id, user_id, log_date)
);

COMMENT ON TABLE public.buddy_challenge_logs IS '1:1 버디 챌린지 일일 인증 기록 (missions 테이블과 독립)';

-- ① 인덱스
CREATE INDEX IF NOT EXISTS idx_buddy_logs_challenge_date
  ON public.buddy_challenge_logs(buddy_challenge_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_buddy_logs_user_date
  ON public.buddy_challenge_logs(user_id, log_date DESC);

-- ② RLS 활성화
ALTER TABLE public.buddy_challenge_logs ENABLE ROW LEVEL SECURITY;

-- ③ SELECT: 인증된 유저 조회 허용
CREATE POLICY "Users can view buddy challenge logs"
  ON public.buddy_challenge_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- ④ INSERT: 본인 데이터만 등록 가능
CREATE POLICY "Users can insert own buddy challenge logs"
  ON public.buddy_challenge_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ⑤ UPDATE: 본인 데이터만 수정 가능
CREATE POLICY "Users can update own buddy challenge logs"
  ON public.buddy_challenge_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ⑥ DELETE: 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own buddy challenge logs"
  ON public.buddy_challenge_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ⑦ 권한 부여
GRANT ALL ON public.buddy_challenge_logs TO authenticated;
GRANT ALL ON public.buddy_challenge_logs TO service_role;

-- ⑧ 적용 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'buddy_challenge_logs';
