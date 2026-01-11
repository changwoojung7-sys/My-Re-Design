-- Mock Data for Yujin (muscle@naver.com) - All Access
INSERT INTO public.payments (user_id, amount, plan_type, duration_months, target_id, status, created_at)
SELECT id, 39000, 'all_12mo', 12, NULL, 'completed', NOW() - INTERVAL '3 months'
FROM public.profiles WHERE email = 'muscle@naver.com';

INSERT INTO public.payments (user_id, amount, plan_type, duration_months, target_id, status, created_at)
SELECT id, 4900, 'all_1mo', 1, NULL, 'completed', NOW() - INTERVAL '15 months'
FROM public.profiles WHERE email = 'muscle@naver.com';

-- Mock Data for Grangge (calamus7@naver.com) - Mission (Health)
INSERT INTO public.payments (user_id, amount, plan_type, duration_months, target_id, status, created_at)
SELECT id, 3900, 'mission_6mo', 6, 'health', 'completed', NOW() - INTERVAL '2 days'
FROM public.profiles WHERE email = 'calamus7@naver.com';

INSERT INTO public.payments (user_id, amount, plan_type, duration_months, target_id, status, created_at)
SELECT id, 990, 'mission_1mo', 1, 'growth', 'completed', NOW() - INTERVAL '2 months'
FROM public.profiles WHERE email = 'calamus7@naver.com';
