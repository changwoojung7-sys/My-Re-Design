# MyReDesign App Context & Documentation

이 파일은 앱의 개발 환경, 아키텍처, 각 화면별 상세 기능, 구독/유료화 모델을 설명합니다.

## 1. 개발 환경 (Development Environment)

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Mobile Runtime**: Capacitor (Android)
- **Styling**: Tailwind CSS + Shadcn/UI (Lucide React icons)
- **State Management**: Zustand (Persistent Storage)
- **Backend / DB**: Supabase (Auth, Database, Storage, Edge Functions)
- **Animation**: Framer Motion, Canvas Confetti
- **Payment**: PortOne V1 (iamport) + V2 SDK
- **Deployment**: Vercel (Web), Google Play Store (Android)

### 주요 라이브러리
- `react-router-dom`: 라우팅 관리
- `canvas-confetti`: 미션 완료 시 축하 효과
- `@capacitor/*`: 네이티브 기능 (카메라, 파일 시스템) 연동
- `framer-motion`: UI 애니메이션 (페이드, 슬라이드, 스케일)

### 폴더 구조
- `src/pages/Home/`: Today(미션), Paywall, PaywallWarning, AdWarning
- `src/pages/Dashboard/`: My Loop (Growth 탭)
- `src/pages/History/`: History, HistoryDetail
- `src/pages/Social/`: Friends
- `src/pages/MyPage/`: MyPage, SubscriptionManager
- `src/pages/Auth/`: Login, ResetPassword
- `src/pages/Onboarding/`: Onboarding
- `src/pages/Admin/`: Admin
- `src/components/`: 공통 UI (MissionLoading, BottomNav, SupportModal, UserGuide 등)
- `src/lib/`: store.ts, supabase.ts, openai.ts, i18n.ts, storageHelper.ts, notificationManager.ts
- `src/config/`: appConfig.ts (버전 관리)
- `supabase/functions/`: Edge Functions (generate-mission, verify-payment, cancel-payment 등)

### 라우팅 구조 (App.tsx)
| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/login` | Login | 로그인 (카카오/이메일) |
| `/onboarding` | Onboarding | 신규 가입 초기 설정 |
| `/reset-password` | ResetPassword | 비밀번호 재설정 |
| `/` | MyPage | 기본 홈 (마이페이지) |
| `/today` | Today | 미션 탭 |
| `/dashboard` | Dashboard | My Loop (Growth) |
| `/history` | History | 히스토리 |
| `/friends` | Friends | 친구 |
| `/mypage` | MyPage | 마이페이지 |
| `/admin` | Admin | 관리자 |

---

## 2. 앱 개요 및 흐름

**MyReDesign**은 사용자가 Body/Mind/Growth/FunPlay 목표를 설정하고, AI가 생성한 맞춤형 데일리 미션을 수행하며 습관을 형성하는 앱입니다.

### 사용자 흐름
1. **Splash/Login**: 카카오 로그인 또는 이메일 로그인. 카카오 리다이렉트 핸들러(`KakaoRedirectHandler`) 내장.
2. **Onboarding**: (신규 유저) 나이, 성별, 주요 목표(Body/Mind/Growth) 설정.
3. **Main (Today)**: 매일 생성되는 미션 확인 및 인증.
4. **하단 탭 네비게이션**: My Loop → Today → Growth → History → Friends
5. **버전 관리**: `appConfig.ts`의 `APP_VERSION` 변경 시 자동 로그아웃 + 캐시 클리어 후 재로그인 강제.

---

## 3. 화면별 상세 기능

### A. 투데이 (Today.tsx) - 미션 탭 `/today`

앱의 메인 화면. 선택된 목표에 따라 AI 미션을 수행합니다.

#### 목표 선택 (Goal Selector)
- **콤보 박스**: 상단에서 활성 목표 중 선택 가능
- **필터링**: `is_completed === true` 또는 `isGoalExpired()` 인 목표는 자동 필터링
- **만료 판단**: `duration_months` 값 기반 (0.25=7일, 0.5=14일, 1+=월×30일)
- **최신 우선**: 카테고리별 최신 목표만 유지 (`latestGoalsMap`)

#### 미션 생성 (Mission Generation)
- **AI 생성**: `generateMissions()` / `generateFunPlayMission()` (src/lib/openai.ts)
- **2단계 프로세스**:
  1. `generateDraftPlan()`: AI가 미션 초안 생성 → `isPreview = true`로 미리보기 표시
  2. `confirmPlan()`: 사용자 "확인 및 시작" 클릭 → DB 저장 → 미션 시작
- **미션 변경(Refresh)**: 일일 3회 제한. `mission_generations` 테이블에서 카운트 추적
- **최근 미션 참조**: 반복 방지를 위해 최근 7일 미션 데이터를 AI에 전달
- **데모 모드**: `user.id === 'demo123'` 시 목업 데이터 사용

#### 미션 인증 (Verification)
- **인증 방식 선택**: 미디어(사진/영상/음성) 또는 텍스트
- **미디어 업로드**: Supabase Storage(`mission-proofs`)에 저장 → URL 반환 → `missions.image_url` 업데이트
- **텍스트 입력**: `missions.proof_text` 필드에 저장
- **인증 편집**: 완료된 미션도 hover 시 수정/삭제 가능 (`handleDeleteMedia`)
- **완료 효과**: `canvas-confetti` 축하 효과 (작은 효과 + 전체 미션 완료 시 큰 효과)
- **챌린지 완료**: 모든 미션 완료 시 "Loop Closed!" 축하 메시지

#### 날짜 이동
- **과거 미션 조회**: 최대 N일 전까지 과거 날짜 선택하여 해당일 미션 확인
- **오늘 아닌 날짜**: 미션 생성/인증 불가 (읽기 전용)

#### 로딩 애니메이션 (MissionLoading)
- **별자리/스파클 애니메이션**: 미션 생성 중 표시
- **메시지 순환**: 4초 간격으로 로딩 메시지 변경
- **프로그레스 바**: 20초 기준 선형 진행

---

### B. My Loop (Dashboard.tsx) - Growth 탭 `/dashboard`

목표별 진행 상황과 AI 코칭을 제공합니다.

#### 통계 대시보드
- **스트릭(🔥 Streak)**: 연속 미션 수행 일수 계산 (`calculateStreak`)
- **완료율**: 전체 미션 대비 완료 비율
- **총 완료 수**: 누적 완료 미션 개수
- **이번 달 미션**: 현재 월 미션 수

#### 캘린더 뷰
- **월별 보기**: 달력 형태로 미션 수행 날짜 표시
- **연도별 보기**: 월별 완료율 그리드
- **네비게이션**: 이전/다음 월/년 이동

#### AI 코칭 인사이트
- `generateCoaching()` 호출 → 목표와 미션 기록 기반 맞춤 코칭 메시지 생성
- 목표별 개별 코칭 제공

#### 목표 선택
- 콤보 박스로 목표 전환 → 해당 목표의 통계/캘린더/코칭 표시

---

### C. 히스토리 (History.tsx) `/history`

과거 미션 기록을 전체적으로 확인합니다.

#### 기록 조회
- **활성 목표**: 현재 진행중인 챌린지 별도 표시
- **완료된 기록**: 과거 종료/만료된 챌린지 목록
- **전체 히스토리**: 날짜순 정렬된 모든 미션 기록

#### 통계 정보
- **미션 수**: 목표별 전체 미션 수 (`fetchMissionCounts`)
- **완료 수**: 목표별 완료된 미션 수 (`fetchCompletedCounts`)
- **달성률**: 완료/전체 비율 표시

#### 상세 보기 (HistoryDetail)
- 특정 목표 클릭 → 날짜별 인증 사진/텍스트 모아보기
- 카테고리 필터링 (Body/Mind/Growth/FunPlay/전체)

---

### D. 친구 (Friends.tsx) `/friends`

친구 관리와 소셜 인터랙션 화면.

#### 친구 관리
- **친구 목록**: 그룹별 또는 전체 친구 표시
- **그룹 관리**: 그룹 생성(`createGroup`), 수정(`updateGroup`), 삭제(`deleteGroup`)
- **미션 상태 탭**: "진행중" / "완료" 필터링

#### 친구 검색 및 추가
- **검색 방식**: 전화번호(뒷자리/전체), 이메일, 닉네임
- **퍼지 검색**: 010→+82 변환 포함
- **그룹 배정**: 친구 추가 시 그룹 선택 가능

#### 소셜 인터랙션
- **응원하기(Like)**: `goal_likes` 테이블 → 좋아요 토글
- **방명록(Comment)**: `goal_comments` 테이블 → 댓글 CRUD
- **기록 보기 요청**: 친구의 상세 미션 기록 열람 권한 요청 (`handleRequestHistory`)
- **공유 기능**: 초대 링크/코드 공유 (`handleShare`)

#### 친구 정보 표시
- 각 친구의 활성 목표, 진행률, 완료 미션 수
- 랭킹 기반 정렬

---

### E. 마이페이지 (MyPage.tsx) `/mypage` (= `/`)

사용자 프로필, 목표 관리, 구독 관리를 위한 화면.

#### 프로필 관리
- **정보 수정**: 닉네임, 나이, 성별, 프로필 이미지
- **프로필 이미지**: Supabase Storage 업로드 (`handleProfileImageUpload`)
- **비밀번호 변경**: 6자 이상 검증 (`handlePasswordUpdate`)

#### 목표(Loop) 관리
- **4가지 카테고리**: Body Wellness / Mind Connection / Growth Career / FunPlay
- **목표 생성/수정**: 목표 텍스트, 기간(duration_months), 세부 설정(난이도, 시간 제한, 분위기 등)
- **목표 만료 판단**: `isGoalExpired()`, `isGoalItemExpired()` 함수
  - `duration_months < 1`: 0.25=7일, 0.5=14일, 기타=월×30일
  - `duration_months >= 1`: 월×30일
- **목표 삭제 (Cascade)**: 관련 미션, 이미지(Storage), 소셜 기록(likes/comments), 기록 열람 권한 모두 삭제
- **완료된 목표 삭제**: 만료/완료 목표 별도 삭제 가능
- **새 챌린지 시작**: 기존 목표 완료 후 동일 카테고리에서 재시작

#### 카테고리 잠금 해제
- `isCategoryUnlocked()`: 구독 상태에 따라 카테고리별 잠금/해제 판단
- **Trial Phase** 중에는 모든 카테고리 접근 가능
- Trial 종료 후 구독 없으면 잠금 → 구독 관리 모달로 유도

#### 알림 설정
- `notificationManager`: 알림 권한 요청 및 관리

#### 기록 열람 요청 관리
- **수신 요청**: 다른 사용자의 기록 열람 요청 확인 (`fetchIncomingRequests`)
- **승인/거부**: `handleApproveRequest` / `handleRejectRequest`

#### 계정 관리
- **로그아웃**: Supabase Auth signOut + 스토어 초기화
- **회원 탈퇴**: 이메일 OTP 인증 → 전체 데이터 삭제 (goals, missions, friends, comments, likes, 미디어 파일)

---

### F. 온보딩 (Onboarding.tsx) `/onboarding`
- 신규 가입 시 최초 진입
- 기본 정보 입력 (나이, 성별)
- Body/Mind/Growth 3개 카테고리 목표 한 번에 설정
- 완료 시 자동으로 첫 미션 생성 → 메인 화면 이동

### G. 로그인 (Login.tsx) `/login`
- **카카오 로그인**: OAuth 기반, 카카오 리다이렉트 핸들러 내장
- **이메일 로그인**: Supabase Auth
- **비밀번호 찾기**: OTP 기반 비밀번호 재설정 (ResetPassword.tsx)
- **데모 계정**: `demo123`으로 체험 가능

### H. 관리자 (Admin.tsx) `/admin`
- 결제 모드(test/real), 광고 슬롯 ID, Paywall 모드(subscription/ads) 등 `admin_settings` 관리

---

## 4. 구독 및 유료화 모델 (Monetization)

### 4-1. Trial Phase (무료 체험)

가입 후 일수에 따라 4단계로 제한이 적용됩니다.

| Phase | 기간 | 설명 |
|-------|------|------|
| Phase 1 | 1~7일 | 완전 무료, 모든 기능 접근 가능 |
| Phase 2 | 8~21일 | 부분 제한 시작 |
| Phase 3 | 22~30일 | 추가 제한 |
| Phase 4 | 31일~ | 무료 체험 종료, 구독 필요 |

- Trial 일수는 **선택된 목표의 `created_at`** 기준으로 계산 (fallback: 프로필 생성일)

### 4-2. Paywall 모드

`admin_settings.paywall_mode`에 따라 두 가지 모드 중 하나가 적용됩니다:

#### 광고 모드 (`ads`)
- **AdWarning 모달**: 무료 체험 종료 후 표시
- **광고 시청 → 미션 잠금 해제**: RewardAd 컴포넌트 (Google AdSense `ad_slot_id` 기반)
- **대안**: "프리미엄 가입" 버튼으로 구독 화면 이동

#### 구독 모드 (`subscription`)
- **PaywallWarning 모달**: 구독 유도 모달
- **Paywall 화면**: 결제 플랜 선택 + PortOne 결제

### 4-3. 구독 플랜 및 가격

#### Mission Plan (카테고리별 개별 구독)
| 기간 | 가격 |
|------|------|
| 1개월 | ₩1,000 |
| 3개월 | ₩2,500 |
| 6개월 | ₩4,500 |
| 12개월 | ₩7,000 |

- 대상 카테고리: Body Wellness, Growth Career, Mind Connection (FunPlay 제외)
- 선택한 카테고리의 미션만 잠금 해제

#### All Access Plan (전체 접근)
| 기간 | 가격 |
|------|------|
| 1개월 | ₩3,000 |
| 3개월 | ₩7,500 |
| 6개월 | ₩12,000 |
| 12개월 | ₩18,000 |

- 모든 카테고리 미션 잠금 해제 (광고 제거 포함)

#### Paywall 긴급 구독 (All Access만)
- Paywall 화면에서 직접 결제 시: All Access 플랜과 동일 가격

### 4-4. 결제 시스템 (SubscriptionManager / Paywall)

#### PortOne V1 (테스트 모드)
- `window.IMP.init('imp05646567')` → `IMP.request_pay()` → KG이니시스(html5_inicis)
- `merchant_uid`: `mid_{timestamp}`

#### PortOne V2 (실 결제 모드)
- `window.PortOne.requestPayment()` → CURRENCY_KRW / CARD
- Store ID: `store-25bcb4a5-...`
- Channel Key: `channel-key-eeaefe66-...`
- **모바일 리다이렉트 처리**:
  - 모바일 환경에서는 PG사 페이지로 이동 후 돌아올 때 `redirectUrl` (`window.location.href`)로 복귀
  - **Android 11+ (API 30+) 앱 가시성 확보**:
    - 보안 강화로 인해 외부 결제 앱(토스, 카드사 앱 등) 호출 시 `AndroidManifest.xml`에 `<queries>` 태그 필수.
    - 주요 카드사 및 간편결제 앱 패키지명(viva.republica.toss, com.kakao.talk 등)을 명시적으로 선언함.
  - **State Preservation (Session Loss 방지)**: 리다이렉트 시 상태 유실 방지를 위해 결제 요청 전 `payments` 테이블에 `status='pending'`으로 레코드를 미리 저장.
  - **Global Payment Check**: `App.tsx`에서 앱 로드 시 `checkMobilePaymentResult`를 전역적으로 호출하여, 어떤 화면으로 복귀하더라도 즉시 성공/실패 알림 표시.
  - **Strict Validation**: 리다이렉트 URL 파라미터(`imp_success`, `success`)를 **엄격하게 검증**하여, 명시적인 성공 신호(`true`)가 없으면 **무조건 실패/취소**로 처리. 이는 사용자 취소(X 버튼) 시 발생할 수 있는 모호한 상태를 방지함.
  - 성공 시 `pending` 레코드를 `paid`로 업데이트.

#### 결제 흐름 (Unified Logic: `src/lib/payment.ts`)
1. **결제 요청**:
   - **DB 저장**: `payments` 테이블에 'pending' 상태로 결제 정보 선저장.
   - V1: `IMP.request_pay()` (Test Mode)
   - V2: `PortOne.requestPayment()` (Real Mode) + `redirectUrl` 설정
2. **결제 결과 처리 (`processPaymentSuccess`)**:
   - **엄격한 검증**: Client-side에서 성공 플래그(`true`) 확인 필수. 실패/취소 시 `processPaymentFailure`로 분기.
   - **Alert 제거**: 내부 `alert` 호출 제거. 에러 객체 반환 → 호출처(`App.tsx` 등)에서 메시지 처리.
   - **전역 체크**: `App.tsx` 마운트 시 `checkMobilePaymentResult` 호출 (모바일 리다이렉트 대응).
   - PC: 콜백 함수에서 즉시 호출
3. **서버 검증 (`verify-payment`)**:
   - PortOne API를 통해 위변조 여부 확인 (V1/V2 자동 분기)
   - **로깅 강화**: 검증 시 결제 상태(`status`), 금액 등을 로그로 남겨 추적 용이성 확보.
   - 실패 시 `alert`로 상세 에러 메시지 표시 (App.tsx에서 통합 처리)
4. **데이터 저장**:
   - `payments` 테이블 INSERT (status: 'paid')
   - `subscriptions` 테이블 INSERT (status: 'active')
5. **(Paywall 전용)**: `profiles.subscription_tier` = 'premium' 업데이트

#### 구독 연장
- 기존 활성 구독이 있으면 `end_date` 이후부터 연장 시작
- 같은 타입(mission/all) + 같은 타겟 카테고리인 경우 연장 적용

#### 결제 취소
- `cancel-payment` Edge Function 호출
- **48시간 이내** 결제만 취소 가능
- 취소 시 `payments.status` → 'cancelled', 해당 구독 비활성화

### 4-5. 구독 확인 로직 (checkStatus)
- `subscriptions` 테이블에서 `status='active'` + 현재 날짜 범위 내 구독 조회
- `type='all'` → 모든 카테고리 접근 가능
- `type='mission'` + `target_id` 매칭 → 해당 카테고리만 접근 가능

---

## 5. 데이터 모델 (Key Tables)

| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (닉네임, 나이, 성별, subscription_tier 등) |
| `user_goals` | 사용자 목표 (category, target_text, duration_months, details, seq 등) |
| `missions` | AI 생성 미션 (content, category, is_completed, image_url, proof_text, proof_type, trust_score, reasoning 등) |
| `mission_generations` | 일일 미션 생성 횟수 추적 (user_id, goal_category, count, date) |
| `subscriptions` | 구독 정보 (type:mission/all, target_id, start_date, end_date, status) |
| `payments` | 결제 내역 (amount, plan_type, imp_uid, merchant_uid, coverage_start/end_date, status: paid/pending/cancelled) |
| `friends` | 양방향 친구 관계 |
| `friend_groups` | 친구 그룹 |
| `goal_likes` | 목표 좋아요 |
| `goal_comments` | 목표 댓글 |
| `history_views` | 기록 열람 권한 (요청/승인/거부) |
| `admin_settings` | 관리자 설정 (payment_mode, ad_slot_id, paywall_mode 등) |

## 6. 특이 사항

- **AI Generation**: Supabase Edge Functions → OpenAI API (generate-mission, generate-coaching)
- **Android Sync**: `npm run build` → `npx cap sync android`
- **PWA Support**: InstallPrompt 컴포넌트로 PWA 설치 유도
- **i18n**: `src/lib/i18n.ts`에서 다국어 지원 (한국어/영어)
- **데모 모드**: `user.id === 'demo123'` 시 결제 차단 + 목업 데이터 사용
- **Auth 동기화**: `onAuthStateChange` 리스너로 세션 만료 시 자동 로그아웃
- **사업자 정보**: 유진에이아이(YujinAI) / 대표: 정창우 / 사업자번호: 519-77-00622
