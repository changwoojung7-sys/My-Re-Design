-- ============================================================
-- 버디 챌린지 미션 RLS 정책 수정
-- 문제: missions 테이블 INSERT 정책이 user_goals 테이블에
--       해당 category의 활성 목표가 있어야만 허용하도록
--       설정되어 있어서, 개인 목표 없이 버디 챌린지만 있는
--       유저는 미션 저장이 실패함.
-- 해결: 버디 챌린지 미션(seq=99, content starts with [⚔️ 대결])은
--       buddy_challenges 테이블 참여 여부로 허용하도록 정책 추가.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-21
-- ============================================================

-- ① 현재 missions 테이블의 모든 INSERT 정책 확인 (실행 후 정책 이름 확인)
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'missions' AND cmd = 'INSERT';

-- ② 기존 INSERT 정책 삭제 후 재생성
-- (정책 이름이 다를 수 있으므로 일반적인 이름들을 모두 DROP)
DROP POLICY IF EXISTS "Users can insert own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can insert missions" ON public.missions;
DROP POLICY IF EXISTS "Enable insert for authenticated users based on user_id" ON public.missions;
DROP POLICY IF EXISTS "Allow users to insert their own missions" ON public.missions;

-- ③ 새 INSERT 정책: 일반 미션 OR 버디 챌린지 미션 모두 허용
CREATE POLICY "Users can insert own missions"
  ON public.missions FOR INSERT
  WITH CHECK (
    -- 기본 조건: 본인의 user_id로만 등록 가능
    auth.uid() = user_id
    AND (
      -- 케이스 1: 일반 미션 - user_goals에 활성 목표가 있는 경우
      EXISTS (
        SELECT 1 FROM public.user_goals
        WHERE user_goals.user_id = auth.uid()
          AND user_goals.category = missions.category
          AND (user_goals.is_completed IS NULL OR user_goals.is_completed = false)
      )
      OR
      -- 케이스 2: 버디 챌린지 미션 - buddy_challenges에 active 상태로 참여 중인 경우
      (
        missions.seq = 99
        AND EXISTS (
          SELECT 1 FROM public.buddy_challenges
          WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
            AND status = 'active'
        )
      )
    )
  );

-- ④ 기존 SELECT 정책도 확인 - buddy challenge 미션 조회 보장
-- (대부분 auth.uid() = user_id 조건으로 이미 올바르게 설정됨)

-- ⑤ 적용 확인
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'missions'
ORDER BY cmd, policyname;
