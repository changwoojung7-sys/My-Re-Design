# MyReDesign App Context & Documentation

이 파일은 앱의 개발 환경, 아키텍처, 각 화면별 상세 기능, 구독/유료화 모델을 설명합니다.

## 1. 개발 환경 (Development Environment)

### Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Mobile Runtime**: Capacitor (Android) + Expo EAS / React Native WebView (`MyReDesign-Expo`, iOS)
- **Styling**: Tailwind CSS + Shadcn/UI (Lucide React icons) + Warm Comfort Slate & Sage Design System (v2.2.3)
- **State Management**: Zustand (Persistent Storage)
- **Backend / DB**: Supabase (Auth, Database, Storage, Edge Functions)
- **Animation**: Framer Motion, Canvas Confetti
- **Payment**: PortOne V1 (iamport) + V2 SDK
- **Deployment**: Vercel (Web), Google Play Store (Android), Apple App Store & TestFlight (iOS)
- **Target Persona**: 인생 2막(50대+) 맞춤형 라이프스타일 코칭 & 웰에이징

### 주요 라이브러리

- `react-router-dom`: 라우팅 관리
- `canvas-confetti`: 미션 완료 시 축하 효과
- `@capacitor/*`: 네이티브 기능 (카메라, 파일 시스템) 연동
- `framer-motion`: UI 애니메이션 (페이드, 슬라이드, 스케일)

### 디자인 시스템 v2.2.3 (Warm Comfort Slate)
- **배경**: 온화한 웜 차콜 (`--bg-base: #121316`, `--bg-surface: #1A1C22`, `--bg-elevated: #23262F`)
- **브랜드**: 자연스러운 세이지 틸/민트 (`--brand-mint: #14B8A6`, `--brand-lime: #84CC16`)
- **카테고리 톤**: 눈이 편안한 파스텔 (Body `#FB7185`, Mind `#A78BFA`, Growth `#38BDF8`, FunPlay `#FB923C`)

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
| `/login` | Login | 로그인 (이메일) |
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

1. **Splash/Login**: 이메일 로그인. 결제 및 소셜 로그인을 방해하는 카카오톡 인앱 브라우저를 외부 브라우저(크롬/사파리)로 강제 전환해주는 리다이렉트 핸들러(`KakaoRedirectHandler`) 내장.
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

#### 미션 생성 및 새로고침 (Mission Generation & Refresh)

- **AI 생성**: `generateMissions()` (src/lib/openai.ts) → Supabase Edge Function `generate-mission`
- **4대 카테고리 지원**: Body, Mind, Growth, FunPlay 전 카테고리에 대해 사용자 `target_text`를 AI 프롬프트(`*_goal`)로 주입
- **2단계 프로세스**:
  1. `generateDraftPlan()`: AI가 미션 초안 생성 → `isPreview = true`로 미리보기 표시
  2. `confirmPlan()`: 사용자 "확인 및 시작" 클릭 → DB 저장 → 미션 시작
- **미션 변경(Refresh) 및 컨디션 반영**:
  - 일일 3회 제한. `mission_generations` 테이블에서 카운트 추적
  - 오늘의 컨디션 이모티콘 변경 또는 미션 변경 버튼 클릭 시 즉시 1회씩 차감되고 DB에 영구 기록
  - 새로고침 트리거 시 기존 미션/드래프트 배열을 즉시 초기화하고 고유 키(`Date.now()`)를 부여하여 로딩 애니메이션 동기화
- **최근 미션 참조**: 반복 방지를 위해 최근 7일 미션 데이터를 AI에 전달
- **데모 모드**: `user.id === 'demo123'` 시 로컬 스토리지 기반 카운트 및 목업 데이터 사용

#### 미션 인증 (Verification)

- **인증 방식 선택**: 미디어(사진/영상/음성) 또는 텍스트
- **미디어 업로드**: Supabase Storage(`mission-proofs`)에 저장 → URL 반환 → `missions.image_url` 업데이트
- **텍스트 입력**: `missions.proof_text` 필드에 저장
- **인증 편집**: 완료된 미션도 hover 시 수정/삭제 가능 (`handleDeleteMedia`)
- **완료 효과**: `canvas-confetti` 축하 효과 (작은 효과 + 전체 미션 완료 시 큰 효과)
- **챌린지 완료**: 모든 미션 완료 시 "Loop Closed!" 축하 메시지 및 단일 일일 회고 팝업 발생

#### 날짜 이동

- **과거 미션 조회**: 최대 N일 전까지 과거 날짜 선택하여 해당일 미션 확인
- **오늘 아닌 날짜**: 미션 생성/인증 불가 (읽기 전용)

#### 로딩 애니메이션 (MissionLoading)

- **별자리/스파클 애니메이션**: 미션 생성 중 표시
- **메시지 순환**: 4초 간격으로 로딩 메시지 변경
- **프로그레스 바**: 20초 기준 선형 진행

---

### B. My Loop (Dashboard.tsx) - Growth 탭 `/dashboard`

목표별 진행 상황과 AI 코칭 및 회고 히스토리를 제공합니다.

#### 통계 대시보드

- **스트릭(🔥 Streak)**: 연속 미션 수행 일수 계산 (`calculateStreak`)
- **완료율**: 전체 미션 대비 완료 비율
- **총 완료 수**: 누적 완료 미션 개수
- **이번 달 미션**: 현재 월 미션 수
- **레벨 & XP 배지**: 게이미피케이션 경험치 및 티어 시각화

#### 캘린더 뷰 & 에너지 레이더 차트

- **주간/월간 뷰**: 달력 형태로 미션 수행 날짜 및 멀티 카테고리 컬러 잼 표시
- **에너지 레이더 차트 (EnergyRadarChart)**: 4개 영역 밸런스 방사형 차트

#### AI 코칭 인사이트 & AI 회고 기록

- `generateCoaching()` 호출 → 목표와 미션 기록 기반 맞춤 코칭 메시지 생성
- **AI 회고 히스토리 (AI Daily Reflection Log)**:
  - 사용자가 작성한 일일 회고와 AI 피드백 표시
  - 일자(`mission_date`)별 중복 필터링(`filterUniqueByDate`)을 적용하여 1일 최신 1건만 깔끔하게 노출

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
- **무비 플레이 (Play Movie)**: 이전 인증 기록들을 영상(릴스) 형태로 모아보는 기능. **유료 구독자가 아닌 경우 (무료 체험 기간 무관하게) 무조건 1편의 보상형 광고를 시청해야 재생 가능.**
- **소셜 공유 (ShareCard)**: 미션 기록들을 모아 숏폼 형태의 예쁜 템플릿(이미지 카드)으로 인스타그램 등 SNS에 공유하는 기능 제공.

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

### F. 온보딩 (`Onboarding.tsx`, `PreTrialOnboarding.tsx`) `/onboarding`

- **PreTrialOnboarding**: 가입 없이 바로 앱을 체험해 볼 수 있는 선체험(데모) 온보딩 플로우. 목표를 입력하고 미션 예제 확인 후, 나이와 성별만 입력하면 즉시 `demo_goals` 로컬스토리지 저장과 함께 7일간의 데모 모드가 시작됩니다.
- 신규 정식 가입 시 최초 진입 (`Onboarding`)
- 기본 정보 입력 (나이, 성별)
- Body/Mind/Growth 3개 카테고리 목표 한 번에 설정
- 완료 시 자동으로 첫 미션 생성 → 메인 화면(MyLoop) 이동

### G. 로그인 (Login.tsx) `/login`

- **카카오 인앱 브라우저 이탈 방지**: 결제 호환성을 위해 `KakaoRedirectHandler`가 카카오톡 인앱 브라우저를 감지하고 크롬/사파리로 강제 리다이렉트 시킴
- **이메일 로그인**: Supabase Auth
- **비밀번호 찾기**: OTP 기반 비밀번호 재설정 (ResetPassword.tsx)
- **데모 계정**: `demo123`으로 체험 가능

### H. 관리자 (Admin.tsx) `/admin`

- 결제 모드(test/real), 광고 슬롯 ID, Paywall 모드(subscription/ads) 등 `admin_settings` 관리

---

## 4. 구독 및 유료화 모델 (Monetization)

### 4-1. Trial Phase (무료 체험 및 락인)

가입 후 첫 7일간 모든 기능을 무료로 체험할 수 있으며, 체험 기간이 만료되면 Paywall이 활성화됩니다.
체험 기간 만료 시 유저가 그동안 쌓은 습관 데이터를 활용하여 심리적 락인(Lock-in) 메시지와 함께 블러(Blur) 처리된 백그라운드를 보여줍니다.

| Phase | 기간 | 설명 |
|-------|------|------|
| 7일 선체험 | 1~7일 | 모든 기능 및 미션 무제한 이용 (로그인 전 데모 유저도 포함) |
| 유료 전환 대기 | 8일~ | 무료 체험 종료. 지속 사용을 위해 프리미엄 플랜 결제 또는 광고 기반 시청 유도 |

- Trial 일수는 계정 생성일(`accountAgeDays`) 기준으로 계산하여 Paywall 락인을 작동시킵니다.

### 4-2. Paywall 모드

`admin_settings.paywall_mode`에 따라 두 가지 모드 중 하나가 적용됩니다:

#### 광고 모드 (`ads`)

- **AdWarning 모달**: 무료 체험 종료 후 표시
- **광고 시청 → 미션 잠금 해제**: RewardAd 컴포넌트 (Google AdSense `ad_slot_id` 기반)
- **대안**: "프리미엄 가입" 버튼으로 구독 화면 이동

#### 구독 모드 (`subscription`)

- **PaywallWarning 모달**: 구독 유도 모달
- **Paywall 화면**: 결제 플랜 선택 + PortOne 결제

### 4-3. 구독 플랜 및 가격 (Premium)

기존 개별 카테고리 미션 플랜과 올액세스 플랜이 통합되어, 모든 기능을 이용할 수 있는 **Premium (All)** 패스로 단순화되었습니다.

| 플랜명 | 기간 | 가격 | 비고 |
|------|------|------|------|
| 1개월 패스 (pro_monthly) | 1개월 | ₩2,900 | 기본형 |
| 3개월 패스 (pro_quarterly) | 3개월 | ₩7,900 | 10% 할인 |
| 1년 패스 (pro_yearly) | 12개월 | ₩29,900 | 15% 할인 (최고 가치) |

- **혜택**: 모든 카테고리 무제한 이용, 과거 미션(Play Movie) 시청 시 팝업 광고 완전 제거, 프리미엄 전용 VIP 뱃지.

### 4-4. 결제 시스템 (SubscriptionManager / Paywall)

#### PortOne V1 (테스트 모드)

- `window.IMP.init('imp05646567')` → `IMP.request_pay()` → KG이니시스(html5_inicis)
- `merchant_uid`: `mid_{timestamp}`

#### PortOne V2 (실 결제 모드)

- `window.PortOne.requestPayment()` → CURRENCY_KRW / CARD
- Store ID: `store-25bcb4a5-...`
- Channel Key: `channel-key-eeaefe66-...`
- **모바일 리다이렉트 처리**:
  - 모바일 환경에서는 PG사 페이지로 이동 후 돌아올 때 `redirectUrl` (`myredesign://payment/result`)로 복귀
  - **Android 앱카드 호출 (Intent)**:
    - Android 환경의 Capacitor WebView에서 기본적으로 `intent://` 형식의 URL(삼성페이, 카드사 앱 등 앱 구동 URL)을 제대로 처리하지 못해 결제 창에서 멈추는 현상을 방지함.
    - 프론트엔드(`redirectUrl` 가로채기)나 커스텀 플러그인(`IntentHandlerPlugin`) 대신, 가장 근본적이고 확실한 방법인 **`MainActivity.java`의 `BridgeWebViewClient`를 오버라이딩**하여 네이티브 단에서 `shouldOverrideUrlLoading`을 통해 외부 앱 인텐트를 실행하도록 강제함.
  - **딥링크(Deep Link) 복귀 및 하얀 화면(White Screen) 에러 해결 로직**:
    - **이슈:** 외부 카드사/은행 앱에서 결제를 마치고 다시 앱으로 복귀했을 때, React 로컬 서버 연결이 끊어지며 앱이 다시 렌더링되지 않고 하얀 화면(White Screen)만 나타나는 현상.
    - **원인:** Android 환경에서 외부 인텐트(결제 앱) 실행 후 되돌아오면 Capacitor WebView의 로컬 서버 세션 주소가 유실되어 페이지 로드를 실패하기 때문.
    - **해결 로직 1 (앱 스키마 설정)**: Paywall.tsx의 결제 요청 파라미터에 `appScheme: 'myredesign'`을 추가하고, `AndroidManifest.xml`의 `<data android:scheme="myredesign" />` 선언과 매칭하여 딥링크 연결점 구성.
    - **해결 로직 2 (WebView 강제 복구)**: 네이티브 최상단인 `MainActivity.java`의 `onNewIntent`와 `handleUrl` 메서드에서 `myredesign://` 패턴의 딥링크 복귀를 감지. 감지 시점 즉시 `bridge.getServerUrl()` (예: `http://localhost`) 주소를 활용해 `view.loadUrl()`을 다시 호출하여 끊어진 웹뷰 세션을 명시적으로 복구함.
    - **해결 로직 3 (화면 새로고침 충돌 제거)**: 프론트엔드 코드(App.tsx 등)에서 모종의 충돌을 일으키던 `window.location.reload()` 호출을 모두 제거하고, 안전한 `window.location.href = '/'` 이동 방식으로 대체하여 화면 그리기 충돌을 원천 차단.
    - **결과:** 이 모든 과정을 통해 앱 복귀 즉시 하얀 화면 없이 메인 UI가 정상 출력되고, React 측의 `appUrlOpen` 이벤트 리스너가 살아남아 유실 없이 `checkMobilePaymentResult` 함수를 통해 결제 완료 처리를 매끄럽게 수행함.
  - **PG사 결제 취소 시 리다이렉트 원복 실패(<http://null> 에러) 해결 로직**:
    - **이슈:** 앱카드 등 외부 결제수단에서 '취소'나 '실패'를 누르고 앱으로 돌아올 때 웹뷰에 `http://null/?code=FAILURE_TYPE_PG... ERR_CLEARTEXT_NOT_PERMITTED` 에러 표시.
    - **원인:** PG사에서 설정된 `redirectUrl`로 리다이렉트 시, 안드로이드 보안 트래픽(Cleartext Traffic) 정책 상 순수 `HTTPS` 프로토콜이 아닌 커스텀 앱 스킴(`myredesign://...`)을 중간 리다이렉트 단계에서 허용하지 않아 트래픽이 차단되며 발생.
    - **해결 로직 (Edge Function 브릿지)**: `myredesign://...` 을 직접 `redirectUrl`로 넘기지 않고, **안전한 HTTPS 주소를 가진 Supabase Edge Function (`payment-redirect`)**을 먼저 거치게 함. Edge Function이 랜딩 HTML 페이지를 반환하며 그 내부 자바스크립트 로직을 통해 딥링크(`window.location.href = 'myredesign://...;'`)로 앱을 띄우도록 우회시켜 근본적으로 문제를 해결.
  - **Android 11+ (API 30+) 앱 가시성 확보**:
    - 보안 강화로 인해 외부 결제 앱(토스, 카드사 앱 등) 호출 시 `AndroidManifest.xml`에 `<queries>` 태그 필수 작성 완료.
  - **State Preservation (Session Loss 방지)**: 리다이렉트 시 상태 유실 방지를 위해 결제 요청 전 `payments` 테이블에 `status='pending'`으로 레코드를 미리 저장.
  - **결제 후 로그아웃 & 구독 미저장 버그 해결 (2026-03-22)**:
    - **원인 1 – `http` vs `https` localhost Origin 불일치**: `MainActivity.java`에서 결제 후 앱 복원 시 `http://localhost`로 `loadUrl()`을 호출했는데, Capacitor의 실제 origin은 `https://localhost`임. 이 두 origin은 브라우저 보안 정책상 완전히 별개의 localStorage를 사용하므로 Supabase 세션 토큰(`sb-*`)이 보이지 않아 자동 로그아웃 발생.
    - **원인 2 – 결제 결과 전달 방식 불일치**: Java가 결제 결과를 `localStorage('payment_return_result')`에 저장했으나 React는 URL 파라미터(`?payment_result=...`)만 읽어서 결과가 누락됨.
    - **원인 3 – 세션 복원 타이밍**: `loadUrl()` 후 앱 재초기화 시 Supabase 세션 복원에 수 초가 걸리는데 그 이전에 `processPaymentSuccess()` 내 `getUser()`가 `null`을 반환해 DB 저장 실패.
    - **해결 1**: `MainActivity.java`의 팝업 WebView, 메인 WebView, `restoreApp()` 모두 `https://localhost`로 통일.
    - **해결 2**: Java에서 결제 결과를 `https://localhost/?payment_result=Uri.encode(query)` URL 파라미터 방식으로 전달. React의 기존 파싱 로직과 정합.
    - **해결 3**: `App.tsx`에서 결제 처리 전 `supabase.auth.getSession()` 폴링(500ms × 최대 12회)으로 세션 복원 대기 후 진행.
    - **해결 4**: `App.tsx`의 결제 성공 판정 로직을 V1(`imp_success`, `imp_uid`, `merchant_uid`)과 V2(`paymentId`, `code`) 파라미터를 모두 올바르게 처리하도록 개선.

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
| `buddy_challenges` | 1:1 버디 챌린지 (creator_id, partner_id, goal_category, challenge_name, start_date, end_date, status: pending/active/completed/cancelled) |
| `ai_reflections` | 일일 단일 회고 기록 (user_id, date, reflection_text, coach_feedback, xp_awarded, is_edited) |
| `share_cards` | 주간 성장 공유 카드 생성 로그 (user_id, image_url, stats, created_at) |
| `xp_logs` | 경험치 획득 로그 (user_id, amount, source, created_at) |
| `user_badges` | 유저 획득 뱃지 (user_id, badge_id, unlocked_at) |

## 6. 특이 사항 & 핵심 정책

- **1:1 버디 챌린지 시스템 (Buddy Challenge)**:
  - **독립 트랙 분리**: 개인 4대 루틴(`Body`, `Mind`, `Growth`, `Funplay`)을 덮어쓰지 않고, Today 화면의 목표 선택 드롭다운에 `⚔️ [1:1 대결] [친구닉네임]님과 대결 - [챌린지명]` 독립 슬롯으로 자동 연동.
  - **대결 기간 선택**: 챌린지 신청 시 3일, 7일(추천), 14일, 30일 중 선택 가능하며, 상대방이 [수락]한 당일부터 Day 1이 시작되어 선택 기간 후 자정에 자동 종료.
  - **상호 동의 기반 중단/삭제**: 대기 중인 요청은 신청자가 즉시 취소 가능하며, 진행 중인 대결은 한쪽의 중단 요청 후 상대방이 [동의하여 종료]를 눌러야 안전하게 종료/삭제 처리됨.
  - **실시간 VS 대결 바 & 넛지**: 친구의 실시간 미션 완수율 비교 및 15초 쿨다운 응원 넛지(찌르기) 알림 지원.
  - **명예의 전당 (히스토리)**: Friends 탭의 [완료] 필터에서 과거 완수한 1:1 챌린지 승리자(🏆) 및 최종 스코어 기록 열람.
- **일일 통합 회고 시스템 (Unified Daily Reflection)**:
  - 카테고리별 분리가 아닌, 하루 1회 작성하는 `ai_reflections_${user.id}_${date}` 기준 당일 통합 회고로 일원화.
  - 당일 3개 미션 완수 후 회고 팝업이 발생하며, 카테고리를 전환하더라도 동일한 최신 회고 내용이 실시간 동기화/수정(UPDATE)됨.
- **7일 무료 적응기간 및 광고 정책**:
  - 목표 생성일(`created_at`) 기준 Day 1 ~ Day 7 동안은 광고 시청 없이 3개 미션 수행 및 하루 3회 미션 변경이 완전 무료로 제공됨.
  - Day 8+ 체험 만료 유저의 경우 미션 확인 및 미션 변경 시 보상형 광고 시청 또는 구독 전환 유도.
- **AI 맞춤형 프롬프트 확장**:
  - `userProfile`에 `age`, `gender`, `height`, `weight`, `job`, `condition_today` 및 구체적 최종 목표 텍스트(`target_text`, e.g. "아침마다 명상하기", "매일 술 한잔씩 하기")가 AI 엔진에 직접 전달되어 3개 맞춤 미션 생성.
- **AI Generation**: Supabase Edge Functions → OpenAI API (generate-mission, generate-coaching)
- **Android Sync**: `npm run build` → `npx cap sync android`
- **PWA Support**: InstallPrompt 컴포넌트로 PWA 설치 유도
- **i18n**: `src/lib/i18n.ts`에서 다국어 지원 (한국어/영어)
- **데모 모드**: `user.id === 'demo123'` 시 결제 차단 + 목업 데이터 사용
- **Auth 동기화**: `onAuthStateChange` 리스너로 세션 만료 시 자동 로그아웃
- **Capacitor localhost origin**: Capacitor는 반드시 `https://localhost`를 사용. `http://localhost`로 `loadUrl()` 호출 시 다른 localStorage origin이 되어 Supabase 세션 토큰 유실 → 결제/인증 버그 유발. Android 네이티브 코드에서 URL 로드 시 항상 `https://localhost` 사용할 것.
- **사업자 정보**: 유진에이아이(YujinAI) / 대표: 정창우 / 사업자번호: 519-77-00622
