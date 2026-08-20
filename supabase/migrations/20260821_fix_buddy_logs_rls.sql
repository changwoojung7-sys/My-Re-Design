-- ============================================================
-- 버디 챌린지 인증 로그 (buddy_challenge_logs) RLS 정책 완전 수정
-- 복잡한 서브쿼리 조인으로 인한 RLS 차단 에러 해결
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-21
-- ============================================================

-- 1. 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Participants can view buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Participants can insert own buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Users can update own buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Users can delete own buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Users can insert own buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Users can view buddy challenge logs" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.buddy_challenge_logs;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.buddy_challenge_logs;

-- 2. RLS 활성화 확인
ALTER TABLE public.buddy_challenge_logs ENABLE ROW LEVEL SECURITY;

-- 3. [SELECT] 인증된 모든 유저 조회 허용 (친구끼리 실시간 인증 사진/글 확인)
CREATE POLICY "Users can view buddy challenge logs"
  ON public.buddy_challenge_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. [INSERT] 본인 데이터만 등록 가능 (auth.uid() = user_id)
CREATE POLICY "Users can insert own buddy challenge logs"
  ON public.buddy_challenge_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. [UPDATE] 본인 데이터만 수정 가능
CREATE POLICY "Users can update own buddy challenge logs"
  ON public.buddy_challenge_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. [DELETE] 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own buddy challenge logs"
  ON public.buddy_challenge_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 7. 권한 부여 확인
GRANT ALL ON public.buddy_challenge_logs TO authenticated;
GRANT ALL ON public.buddy_challenge_logs TO service_role;

-- 8. 적용 확인
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'buddy_challenge_logs'
ORDER BY cmd, policyname;
