# 🚀 MyReDesign 단계별 리뉴얼 실행 계획

> **목표**: 2030 세대가 매일 켜보고 싶은 '라이프 디자인 OS'로 탈바꿈  
> **기준 문서**: `mdfile/리뉴얼 플랜.md`, `mdfile/Context.md`  
> **현재 버전**: v2.1.6 (React 19 + Vite + Capacitor + Supabase)

---

## 📋 전체 로드맵 요약

| 단계 | 이름 | 핵심 목표 | 기간 (예상) |
|------|------|-----------|-------------|
| **Phase 1** | 디자인 시스템 리뉴얼 | 다크모드 + 네온 팔레트 + Bento Grid | 1~2주 |
| **Phase 2** | Growth 탭 대시보드 개편 | 레이더 차트, 레벨 시스템, 컬러 잼 캘린더 | 2~3주 |
| **Phase 3** | 게이미피케이션 & 뱃지 시스템 | XP/레벨/트로피 룸 + 트리거 전략 | 2주 |
| **Phase 4** | AI 코칭 2.0 | 대화형 챗봇 + 주간 AI 리포트 | 2~3주 |
| **Phase 5** | 소셜 & 바이럴 기능 | 공유 카드, 버디 챌린지, 숏폼 무비 | 2주 |
| **Phase 6** | 유료화 구조 개편 | Freemium 전환 + Pro 단일화 | 1~2주 |
| **Phase 7** | 온보딩 + Paywall UX 개선 | 선체험/후가입, 심리적 락인 | 1주 |

---

## Phase 1. 디자인 시스템 리뉴얼

### 🎯 목표
기존 전형적인 헬스앱 스타일 → **다크 슬레이트 + 네온 하이라이트** 또는 **오프화이트 + 비비드 팝** 감성으로 전면 전환

### 작업 목록

#### 1-1. 디자인 토큰 & CSS 변수 정의 (`src/index.css` 또는 `tailwind.config.js`)

```css
/* 배경 */
--bg-base: #0F172A;           /* Deep Dark Slate */
--bg-surface: #1E293B;        /* Card 배경 */

/* 브랜드 컬러 */
--brand-mint: #10B981;
--brand-lime: #A3E635;

/* 카테고리 팝 컬러 */
--cat-body: #FF5757;          /* Hot Coral */
--cat-mind: #8B5CF6;          /* Lavender Purple */
--cat-growth: #06B6D4;        /* Electric Cyan */
--cat-funplay: #F97316;       /* Bright Sunset Orange */
```

#### 1-2. 컴포넌트 스타일 업데이트

| 컴포넌트 | 변경 내용 |
|----------|-----------|
| 카드 UI | `border-radius: 24px`, Glassmorphism (`backdrop-blur` + `border-white/10`) |
| 타이포그래피 | Pretendard Black 폰트 적용 (Google Fonts or CDN) |
| BottomNav | Floating Island 형태 (살짝 떠있는 바) + 슬라이딩 인디케이터 |
| 버튼 | 네온 그라데이션 + 호버 시 glow 효과 |
| 스트릭 카운터 | 3D 불꽃 이모지 + Framer Motion 애니메이션 |

#### 1-3. DB 변경사항
> ❌ Phase 1은 DB 변경 없음 (순수 프론트엔드 작업)

---

## Phase 2. Growth 탭 대시보드 전면 개편

### 🎯 목표
정적 달력/표 → **게임형 레벨 배지 + 레이더 차트 + 컬러 잼 캘린더**

### 작업 목록

#### 2-1. 레이더 차트 (4각 에너지 코어)
- **라이브러리**: `recharts` 또는 `react-chartjs-2` (Radar Chart)
- Body / Mind / Growth / FunPlay 4개 영역 주간 완료율 → 다각형 시각화
- 부족한 영역 AI 추천 문구 표시

#### 2-2. 컬러 잼 캘린더 (GitHub 잔디 대체)
- 날짜별 완료 카테고리 색상을 혼합 → 보석처럼 빛나는 멀티컬러 히트맵
- 기존 `Dashboard.tsx` 캘린더 뷰 교체

#### 2-3. AI 주간 바이브 리포트 카드 (Card News 형태)
- 주간 통계 분석 → OpenAI 호출 → 한 줄 인사이트 카드로 표시
- 슬라이드형 카드뉴스 UI

### 🗃️ DB 확장 - Phase 2

#### `weekly_energy_stats` (신규 테이블)
> 주간 카테고리별 완료율을 캐싱하여 레이더 차트 렌더링 최적화

```sql
CREATE TABLE weekly_energy_stats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   date NOT NULL,         -- ISO 주의 월요일
  body_score   numeric(5,2) DEFAULT 0,
  mind_score   numeric(5,2) DEFAULT 0,
  growth_score numeric(5,2) DEFAULT 0,
  funplay_score numeric(5,2) DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);
```

#### `ai_weekly_reports` (신규 테이블)
> AI 주간 리포트 캐싱 (중복 API 호출 방지)

```sql
CREATE TABLE ai_weekly_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  report_text text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);
```

#### `missions` 테이블 컬럼 추가
```sql
ALTER TABLE missions 
  ADD COLUMN xp_reward integer DEFAULT 10;  -- 미션 완료 시 지급 XP
```

---

## Phase 3. 게이미피케이션 & 뱃지 시스템

### 🎯 목표
**유저 레벨 / XP / 트로피 룸** 도입으로 장기 잔존율(Retention) 극대화

### 레벨 정의 (예시)

| 레벨 | 타이틀 | 필요 누적 XP |
|------|--------|-------------|
| Lv.1 | 비기너 | 0 |
| Lv.5 | 루틴 탐험가 | 200 |
| Lv.10 | 해빗 빌더 | 600 |
| Lv.15 | 라이프 크리에이터 | 1,200 |
| Lv.20 | 라이프 아키텍트 | 2,500 |

### 뱃지 정의 (예시)

| 뱃지 | 조건 |
|------|------|
| 🏃 얼리버드 | 오전 7시 이전 미션 완료 7회 |
| 🧘 마인드마스터 | Mind 미션 30개 달성 |
| 🔥 불꽃런너 | 14일 연속 스트릭 |
| 🎯 퍼펙트위크 | 1주 모든 미션 100% 완료 |
| 👑 라이프 킹 | Lv.20 달성 |

### 🗃️ DB 확장 - Phase 3

#### `profiles` 테이블 컬럼 추가
```sql
ALTER TABLE profiles
  ADD COLUMN total_xp        integer DEFAULT 0,
  ADD COLUMN current_level   integer DEFAULT 1,
  ADD COLUMN level_title     text DEFAULT '비기너',
  ADD COLUMN condition_today smallint DEFAULT 3;  -- 오늘 컨디션 (1~5)
```

#### `badges` (신규 테이블 - 마스터 정의)
```sql
CREATE TABLE badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,    -- 'early_bird', 'mind_master' 등
  name        text NOT NULL,
  emoji       text NOT NULL,
  description text,
  condition   jsonb                    -- 조건 메타데이터
);
```

#### `user_badges` (신규 테이블 - 유저 획득 기록)
```sql
CREATE TABLE user_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   uuid NOT NULL REFERENCES badges(id),
  earned_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
```

#### `xp_logs` (신규 테이블 - XP 획득 내역)
```sql
CREATE TABLE xp_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     integer NOT NULL,
  reason     text,                     -- 'mission_complete', 'streak_bonus' 등
  ref_id     uuid,                     -- 관련 mission/goal id
  created_at timestamptz DEFAULT now()
);
```

---

## Phase 4. AI 코칭 2.0 - 대화형 라이프 어드바이저

### 🎯 목표
단방향 코칭 텍스트 → **AI 회고 챗봇 + 맞춤형 인사이트 카드**

### 작업 목록

#### 4-1. 인터랙티브 AI 회고 (완료 및 일일 단일 통합)
- 하루 미션 완료 시 통합 회고 팝업 발생 (카테고리 전환 시에도 당일 최신 회고 동기화)
- 대시보드 렌더링 시 일자(`mission_date`)별 최신 1건만 노출하도록 중복 필터링(`filterUniqueByDate`) 적용
- 답변을 주간/월간 리포트 및 다음 미션 생성에 반영

#### 4-2. 컨디션 반응형 미션 조절 및 FunPlay 맞춤 생성 (완료)
- Today 탭 진입 시 당일 컨디션(1~5) 이모티콘 선택 및 미션 변경 시 즉시 카운트(3회 제한) 차감 및 DB 동기화
- FunPlay 카테고리 포함 전 영역 사용자 커스텀 목표(`target_text`) AI 프롬프트 주입 완벽 연동

### 🗃️ DB 확장 - Phase 4

#### `ai_reflections` (신규 테이블 - 회고 챗 기록)
```sql
CREATE TABLE ai_reflections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_date date NOT NULL,
  question    text NOT NULL,
  answer      text,
  ai_response text,
  created_at  timestamptz DEFAULT now()
);
```

#### `user_goals` 테이블 컬럼 추가
```sql
ALTER TABLE user_goals
  ADD COLUMN difficulty_level text DEFAULT 'normal';  -- 'easy', 'normal', 'hard'
```

#### `missions` 테이블 컬럼 추가 (Phase 4 추가분)
```sql
ALTER TABLE missions
  ADD COLUMN condition_at_time smallint,              -- 미션 생성 시 유저 컨디션
  ADD COLUMN difficulty_adjusted boolean DEFAULT false; -- 컨디션 기반 난이도 조절 여부
```

---

## Phase 5. 소셜 & 바이럴 기능

### 🎯 목표
'인스타 스토리 공유 카드' + '버디 챌린지' + '숏폼 히스토리 무비' 강화

### 작업 목록

#### 5-1. 주간 성장 공유 카드 (9:16 자동 생성)
- `html2canvas` 또는 `canvas` API로 카드 이미지 생성
- 이번 주 스트릭 + 레이더 차트 스냅샷 + AI 칭찬 한 줄 포함
- 인스타그램/카카오 공유 Capacitor Share 플러그인 연동

#### 5-2. 버디(Buddy) 챌린지
- 1:1 공동 챌린지 생성
- 상대방 미완료 시 AI 넛지 알림 발송

#### 5-3. 숏폼 히스토리 무비 템플릿
- 기존 무비 기능 → BGM 비트싱크 + 텍스트 오버레이 템플릿 선택
- Pro 유저: 워터마크 없이 고화질 내보내기

### 🗃️ DB 확장 - Phase 5

#### `buddy_challenges` (신규 테이블)
```sql
CREATE TABLE buddy_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid NOT NULL REFERENCES auth.users(id),
  partner_id    uuid NOT NULL REFERENCES auth.users(id),
  goal_category text NOT NULL,
  start_date    date NOT NULL,
  end_date      date,
  status        text DEFAULT 'active',  -- 'active', 'completed', 'cancelled'
  created_at    timestamptz DEFAULT now()
);
```

#### `share_cards` (신규 테이블 - 공유 카드 생성 로그)
```sql
CREATE TABLE share_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  card_url    text,                     -- Supabase Storage URL
  created_at  timestamptz DEFAULT now()
);
```

---

## Phase 6. 유료화 구조 개편 (Freemium → Pro 단일화)

### 🎯 목표
카테고리별 개별 구독 폐지 → **'MyReDesign Pro' 단일 멤버십** + Freemium 기반 Lock-in

### 신규 가격 플랜

| 플랜 | 가격 | 비고 |
|------|------|------|
| Free (영구) | 무료 | 1 카테고리, 기본 AI 미션 3개, 광고 있음 |
| Pro 월간 | ₩3,900 / 월 | 전체 카테고리, 광고 제거, AI 코칭 2.0 |
| Pro 연간 | ₩24,000 / 년 | 월 ₩2,000 수준, **50% 할인 강조** |

### 전환 트리거 (Nudge) 전략

1. **골든 타임 팝업**: 7일 연속 달성 직후 → 할인 쿠폰 팝업
2. **히스토리 무비 완성 시점**: 고화질 내보내기 Pro 유도
3. **친구 초대 2명**: 1개월 무료 이용권 지급

### 🗃️ DB 확장 - Phase 6

#### `subscriptions` 테이블 변경
```sql
-- plan_type 컬럼 추가 (기존 type 컬럼과 별개)
ALTER TABLE subscriptions
  ADD COLUMN plan_type text DEFAULT 'pro_monthly';  
  -- 'pro_monthly', 'pro_yearly', 'free'

-- 기존 type='mission' 플랜은 만료 후 자동으로 pro 체계로 마이그레이션 필요
```

#### `referrals` (신규 테이블 - 친구 초대 추적)
```sql
CREATE TABLE referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES auth.users(id),
  referred_id  uuid NOT NULL REFERENCES auth.users(id),
  reward_given boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(referred_id)
);
```

#### `promo_codes` (신규 테이블 - 프로모션 쿠폰)
```sql
CREATE TABLE promo_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,
  discount_type  text NOT NULL,          -- 'percent', 'fixed', 'free_months'
  discount_value numeric(10,2) NOT NULL,
  max_uses       integer DEFAULT 1,
  used_count     integer DEFAULT 0,
  expires_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);
```

#### `profiles` 테이블 컬럼 추가 (Phase 6 추가분)
```sql
ALTER TABLE profiles
  ADD COLUMN plan_type        text DEFAULT 'free',   -- 'free', 'pro_monthly', 'pro_yearly'
  ADD COLUMN referral_code    text UNIQUE,           -- 본인 초대 코드
  ADD COLUMN invited_by       uuid REFERENCES auth.users(id);
```

---

## Phase 7. 온보딩 & Paywall UX 개선 (완료)

### 🎯 목표
'선(先)체험 후(後)가입' 패스트트랙 + 심리적 락인 메시지 Paywall

### 작업 목록

#### 7-1. 선체험 온보딩 플로우 (완료)
- [x] 로그인 없이 목표 1개 입력 → AI 미션 3개 즉시 맛보기
- [x] "이 루틴으로 시작하기" → 데모 모드로 나이/성별 입력 후 곧바로 MyLoop 수정 모드로 진입
- [x] 임시 `demo_goals` localStorage로 상태 유지

#### 7-2. Paywall 심리적 락인 메시지 (완료)
- [x] 가입일(accountAgeDays) 기반으로 무료 체험 만료 락인 문구 및 블러(Blur) 처리 구현 완료

#### 7-3. 7일 Soft Trial 전환 (완료)
- [x] 기존 30일 무료 → **7일 무료 체험** 후 자동 Pro 결제 안내로 Today 탭 변경 완료

#### 7-4. 소셜 공유 기능 (완료)
- [x] HistoryDetail 모달 내에 소셜 숏폼(이미지) 공유 ShareCard 연동 완료

### 🗃️ DB 변경 - Phase 7

#### `profiles` 테이블 컬럼 변경
```sql
-- trial_phase 일수 기준 변경 (30일 → 7일)
-- 기존 로직: Phase 1(1~7일) / Phase 2(8~21일) / Phase 3(22~30일) / Phase 4(31일~)
-- 변경 후:   7일 내 모든 기능 → 8일부터 Freemium 적용
-- (코드 레벨 변경, 테이블 스키마 변경 불필요)
```

---

## 📊 전체 DB 변경 요약

### 신규 테이블 (총 9개)

| 테이블 | Phase | 목적 |
|--------|-------|------|
| `weekly_energy_stats` | 2 | 레이더 차트용 주간 카테고리 점수 캐싱 |
| `ai_weekly_reports` | 2 | AI 주간 리포트 캐싱 |
| `badges` | 3 | 뱃지 마스터 정의 |
| `user_badges` | 3 | 유저 획득 뱃지 기록 |
| `xp_logs` | 3 | XP 획득 내역 |
| `ai_reflections` | 4 | AI 회고 챗 기록 |
| `buddy_challenges` | 5 | 버디 챌린지 |
| `share_cards` | 5 | 공유 카드 생성 로그 |
| `referrals` | 6 | 친구 초대 추적 |
| `promo_codes` | 6 | 프로모션 쿠폰 |

### 기존 테이블 컬럼 추가 요약

| 테이블 | 추가 컬럼 |
|--------|-----------|
| `profiles` | `total_xp`, `current_level`, `level_title`, `condition_today`, `plan_type`, `referral_code`, `invited_by` |
| `missions` | `xp_reward`, `condition_at_time`, `difficulty_adjusted` |
| `user_goals` | `difficulty_level` |
| `subscriptions` | `plan_type` |

---

## ⚡ 권장 실행 순서 (빠른 효과 순)

```
Phase 1 (디자인) → Phase 3 (레벨/뱃지) → Phase 2 (대시보드)
    → Phase 6 (유료화 개편) → Phase 4 (AI 코칭) → Phase 5 (소셜) → Phase 7 (온보딩)
```

> Phase 1 & 3을 먼저 실행하면 **앱 첫인상 + 재방문 동기**를 동시에 확보할 수 있어 가장 높은 ROI를 기대할 수 있습니다.
