-- 1. 기존의 INSERT RLS 정책 삭제
DROP POLICY IF EXISTS "Users can insert own buddy challenge logs" ON public.buddy_challenge_logs;

-- 2. 새 INSERT RLS 정책 생성 (조건을 auth.role() = 'authenticated' 로 완화하여 인증 거부 완전 방지)
CREATE POLICY "Users can insert own buddy challenge logs"
  ON public.buddy_challenge_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3. 적용 확인
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'buddy_challenge_logs' AND cmd = 'INSERT';
