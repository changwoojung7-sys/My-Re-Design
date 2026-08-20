-- ============================================================
-- DB 마이그레이션 실행 확인 쿼리
-- Supabase Dashboard → SQL Editor에서 실행하여
-- 각 마이그레이션이 정상 적용되었는지 확인하세요.
-- ============================================================

-- 1. 신규 테이블 존재 여부 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'weekly_energy_stats',
    'ai_weekly_reports',
    'badges',
    'user_badges',
    'xp_logs',
    'ai_reflections',
    'buddy_challenges',
    'share_cards',
    'referrals',
    'promo_codes',
    'user_promo_uses'
  )
ORDER BY table_name;

-- 2. profiles 신규 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'total_xp', 'current_level', 'level_title',
    'condition_today', 'plan_type', 'referral_code', 'invited_by'
  )
ORDER BY column_name;

-- 3. missions 신규 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
  AND column_name IN (
    'xp_reward', 'condition_at_time', 'difficulty_adjusted'
  )
ORDER BY column_name;

-- 4. user_goals 신규 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_goals'
  AND column_name IN ('difficulty_level')
ORDER BY column_name;

-- 5. subscriptions 신규 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name IN ('plan_type')
ORDER BY column_name;

-- 6. 기본 뱃지 데이터 확인
SELECT key, name, emoji, description FROM public.badges ORDER BY created_at;

-- 7. 기본 프로모션 코드 확인
SELECT code, discount_type, discount_value, max_uses, expires_at
FROM public.promo_codes ORDER BY created_at;
