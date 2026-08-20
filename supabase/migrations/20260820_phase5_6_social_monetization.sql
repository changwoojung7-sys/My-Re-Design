-- ============================================================
-- Phase 5: 소셜 & 바이럴 - 버디 챌린지 + 공유 카드
-- Phase 6: 유료화 개편 - Pro 단일화 + 초대/쿠폰
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 작성일: 2026-08-20
-- ============================================================

-- ================================================================
-- PHASE 5: 소셜 & 바이럴
-- ================================================================

-- ----------------------------------------------------------------
-- 1. buddy_challenges: 1:1 버디 챌린지
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buddy_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_category text NOT NULL CHECK (
    goal_category IN ('body_wellness', 'mind_connection', 'growth_career', 'funplay')
  ),
  challenge_name text,                              -- 챌린지 이름 (선택)
  start_date    date NOT NULL,
  end_date      date,                               -- null 이면 종료 없음
  status        text DEFAULT 'pending'              -- 'pending', 'active', 'completed', 'cancelled'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT no_self_challenge CHECK (creator_id <> partner_id)
);

COMMENT ON TABLE public.buddy_challenges IS '1:1 버디 챌린지 (공동 목표 달성)';

-- ----------------------------------------------------------------
-- 2. share_cards: 주간 성장 공유 카드 생성 로그
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  card_url    text,                                 -- Supabase Storage 저장 URL
  metadata    jsonb,                                -- 카드 생성 시 사용된 메타데이터 (streak, scores 등)
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.share_cards IS '인스타그램 스토리용 주간 성장 공유 카드 생성 로그';

-- ================================================================
-- PHASE 6: 유료화 구조 개편
-- ================================================================

-- ----------------------------------------------------------------
-- 3. profiles 테이블 컬럼 추가: Pro 플랜 + 초대 코드
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type     text DEFAULT 'free'
    CHECK (plan_type IN ('free', 'pro_monthly', 'pro_yearly')),
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,              -- 본인 친구 초대 코드
  ADD COLUMN IF NOT EXISTS invited_by    uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.profiles.plan_type IS '현재 구독 플랜 (free/pro_monthly/pro_yearly)';
COMMENT ON COLUMN public.profiles.referral_code IS '이 유저의 친구 초대 코드 (고유값)';
COMMENT ON COLUMN public.profiles.invited_by IS '이 유저를 초대한 유저의 user_id';

-- ----------------------------------------------------------------
-- 4. subscriptions 테이블 컬럼 추가: 신규 plan_type 체계
-- ----------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'pro_monthly'
    CHECK (plan_type IN ('pro_monthly', 'pro_yearly', 'mission_plan'));

COMMENT ON COLUMN public.subscriptions.plan_type IS '구독 플랜 타입 (pro_monthly/pro_yearly/mission_plan)';

-- ----------------------------------------------------------------
-- 5. referrals: 친구 초대 추적
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_given boolean DEFAULT false,               -- 보상 지급 여부
  reward_type  text DEFAULT 'free_month',           -- 'free_month', 'discount' 등
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT uq_referred UNIQUE (referred_id),      -- 한 유저는 1명의 초대자만
  CONSTRAINT no_self_referral CHECK (referrer_id <> referred_id)
);

COMMENT ON TABLE public.referrals IS '친구 초대 추적 (초대한 사람 → 초대된 사람)';

-- ----------------------------------------------------------------
-- 6. promo_codes: 프로모션 할인 코드
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,              -- 대문자 코드 (e.g. 'STREAK7')
  discount_type  text NOT NULL
    CHECK (discount_type IN ('percent', 'fixed_krw', 'free_months')),
  discount_value numeric(10,2) NOT NULL,            -- percent=50 → 50%, fixed_krw=1900 → ₩1,900 할인, free_months=1 → 1개월 무료
  applicable_plan text DEFAULT 'all'
    CHECK (applicable_plan IN ('all', 'pro_monthly', 'pro_yearly')),
  max_uses       integer DEFAULT 1,                 -- 최대 사용 횟수
  used_count     integer DEFAULT 0,
  expires_at     timestamptz,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE public.promo_codes IS 'Pro 구독 전환 유도용 프로모션 쿠폰 코드';

-- ----------------------------------------------------------------
-- 7. user_promo_uses: 유저별 쿠폰 사용 이력
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_promo_uses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_id    uuid NOT NULL REFERENCES public.promo_codes(id),
  used_at     timestamptz DEFAULT now(),
  payment_id  uuid,                                 -- 연결된 결제 ID (nullable)
  CONSTRAINT uq_user_promo UNIQUE (user_id, promo_id)  -- 동일 쿠폰 중복 사용 방지
);

COMMENT ON TABLE public.user_promo_uses IS '유저별 프로모션 쿠폰 사용 이력';

-- ----------------------------------------------------------------
-- 8. Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_buddy_challenges_creator
  ON public.buddy_challenges(creator_id, status);

CREATE INDEX IF NOT EXISTS idx_buddy_challenges_partner
  ON public.buddy_challenges(partner_id, status);

CREATE INDEX IF NOT EXISTS idx_share_cards_user_week
  ON public.share_cards(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals(referrer_id);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code
  ON public.promo_codes(code) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_promo_uses_user
  ON public.user_promo_uses(user_id);

-- ----------------------------------------------------------------
-- 9. RLS 활성화
-- ----------------------------------------------------------------
ALTER TABLE public.buddy_challenges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_promo_uses   ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 10. RLS Policies - buddy_challenges
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own buddy challenges"
  ON public.buddy_challenges FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = partner_id);

CREATE POLICY "Users can create buddy challenges"
  ON public.buddy_challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own buddy challenges"
  ON public.buddy_challenges FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = partner_id);

-- ----------------------------------------------------------------
-- 11. RLS Policies - share_cards
-- ----------------------------------------------------------------
CREATE POLICY "Users can manage own share cards"
  ON public.share_cards FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 12. RLS Policies - referrals
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id);

-- ----------------------------------------------------------------
-- 13. RLS Policies - promo_codes (공개 읽기, 관리자 수정)
-- ----------------------------------------------------------------
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- 14. RLS Policies - user_promo_uses
-- ----------------------------------------------------------------
CREATE POLICY "Users can read own promo uses"
  ON public.user_promo_uses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own promo uses"
  ON public.user_promo_uses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 15. Grants
-- ----------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.buddy_challenges TO authenticated;
GRANT ALL ON public.buddy_challenges TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_cards TO authenticated;
GRANT ALL ON public.share_cards TO service_role;

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

GRANT SELECT ON public.promo_codes TO authenticated, anon;
GRANT ALL ON public.promo_codes TO service_role;

GRANT SELECT, INSERT ON public.user_promo_uses TO authenticated;
GRANT ALL ON public.user_promo_uses TO service_role;

-- ----------------------------------------------------------------
-- 16. 기본 프로모션 코드 삽입 (예시)
-- ----------------------------------------------------------------
INSERT INTO public.promo_codes (code, discount_type, discount_value, applicable_plan, max_uses, expires_at) VALUES
  ('STREAK7',   'percent',      50,    'pro_monthly', 1000, now() + interval '6 months'),
  ('NEWSTART',  'free_months',   1,    'all',          500, now() + interval '3 months'),
  ('ANNUAL50',  'percent',      50,    'pro_yearly',   300, now() + interval '1 month')
ON CONFLICT (code) DO NOTHING;
