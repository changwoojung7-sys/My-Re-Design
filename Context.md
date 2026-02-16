# ONANBU (오난부) App Context & Documentation

이 파일은 앱의 개발 환경, 아키텍처, 그리고 각 화면별 상세 기능을 설명합니다. 개발 또는 유지보수 시 이 파일을 참고하여 앱의 전체적인 구조를 파악할 수 있습니다.

## 1. 개발 환경 (Development Environment)

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Mobile Runtime**: Capacitor (Android)
- **Styling**: Tailwind CSS + Shadcn/UI (Lucide React icons)
- **State Management**: Zustand (Persistent Storage)
- **Backend / DB**: Supabase (Auth, Database, Storage, Edge Functions)
- **Animation**: Framer Motion, Canvas Confetti
- **Deployment**: Vercel (Web), Google Play Store (Android)

### 주요 라이브러리 (Key Libraries)
- `react-router-dom`: 라우팅 관리
- `canvas-confetti`: 미션 완료 시 축하 효과
- `@capacitor/*`: 네이티브 기능 (카메라, 파일 시스템 등) 연동
- `date-fns`: (사용 여부 확인 필요, 현재 코드는 native Date 사용 중)

### 폴더 구조 (Folder Structure)
- `src/pages`: 주요 화면 컴포넌트 (Home, Social, MyPage, History, etc.)
- `src/components`: 재사용 가능한 UI 컴포넌트
- `src/lib`: 유틸리티, 스토어(`store.ts`), Supabase 클라이언트(`supabase.ts`)
- `src/config`: 앱 설정 상수
- `supabase`: Supabase 관련 설정 및 Edge Functions

---

## 2. 앱 개요 및 흐름 (App Overview & Flow)

**ONANBU**는 사용자가 신체적(Body), 정신적(Mind), 성장(Growth) 목표를 설정하고, AI가 생성한 맞춤형 데일리 미션을 수행하며 습관을 형성하는 앱입니다. 친구들과 서로의 진행 상황을 공유하고 응원하는 소셜 기능이 포함되어 있습니다.

### 사용자 흐름 (User Flow)
1. **Splash/Login**: 카카오 로그인 또는 이메일 로그인.
2. **Onboarding**: (신규 유저) 나이, 성별, 주요 목표(3가지 카테고리) 설정.
3. **Main (Today)**: 매일 생성되는 미션 확인 및 인증.
4. **Social/History/MyPage**: 하단 탭을 통해 접근.

---

## 3. 화면별 상세 기능 (Detailed Screen Functions)

### A. 투데이 (Today.tsx) - `src/pages/Home/Today.tsx`
앱의 메인 화면입니다.

*   **미션 생성 및 표시**:
    *   선택된 목표(Goal)에 따라 AI(OpenAI)가 미션을 생성합니다.
    *   미션은 '텍스트 인증', '사진/영상 인증', '체크박스' 타입으로 나뉩니다.
    *   데모 계정(`demo123`)은 목업 데이터를 사용합니다.
*   **미션 인증 (Verification)**:
    *   사진/영상 업로드: Supabase Storage(`mission-proofs`)에 저장.
    *   텍스트 입력: DB에 텍스트 저장.
    *   완료 시 `confetti` 효과 발생.
*   **유료화 모델 (Monetization)**:
    *   **Trial Phase**: 가입 일수에 따라 제한 적용 (Phase 1~4).
    *   **Paywall**: 무료 기간 종료 후 구독이 없으면 미션 잠금.
    *   **Reward Ads**: 미션 새로고침(Refresh)을 위해 광고 시청 필요.
*   **FunPlay**:
    *   간단한 미니 게임성 미션. "오늘의 재미"를 위한 카테고리.

### B. 친구 (Friends.tsx) - `src/pages/Social/Friends.tsx`
친구들을 관리하고 진행 상황을 확인합니다.

*   **친구 목록 및 랭킹**:
    *   친구들의 목표 진행률, 완료한 미션 수 등을 기반으로 랭킹 표시.
    *   친구 그룹(Group) 생성 및 관리 가능.
    *   미션 상태 탭: "진행중", "완료" 필터링.
*   **친구 추가 (Search)**:
    *   전화번호(뒷자리 또는 전체), 이메일, 닉네임으로 검색.
    *   퍼지 검색 지원 (010 -> +82 변환 포함).
*   **인터랙션**:
    *   응원하기(Like): 친구의 목표에 '좋아요' 표시.
    *   방명록(Comment): 친구의 목표에 댓글 남기기.
    *   기록 보기 요청: 친구의 상세 기록 열람 권한 요청.

### C. 마이페이지 (MyPage.tsx) - `src/pages/MyPage/MyPage.tsx`
사용자 정보 및 목표 설정 관리.

*   **프로필 관리**: 닉네임, 나이, 성별, 프로필 이미지 수정.
*   **목표(Loop) 관리**:
    *   Body/Mind/Growth/FunPlay 4가지 카테고리별 목표 설정.
    *   각 목표의 기간, 세부 내용 수정.
    *   **Goal Deletion**: 목표 삭제 시 관련 미션, 이미지, 소셜 기록 모두 삭제 (Cascade 로직 구현).
*   **설정 및 계정**:
    *   비밀번호 변경.
    *   **회원 탈퇴**: 이메일 OTP 인증 후 계정 및 데이터 영구 삭제.
*   **구독 관리**: 현재 구독 상태 확인.

### D. 히스토리 (History.tsx) - `src/pages/History/History.tsx`
과거 미션 기록 확인.

*   **필터링**: 카테고리별(Body/Mind/Growth/FunPlay) 또는 전체 보기.
*   **상태**: 진행 중인 첼린지와 완료된 첼린지 구분.
*   **시각화**: 달성률, 시작일~종료일, 성공한 미션 수 표시.
*   **상세 보기**: 날짜별 인증 사진/텍스트 모아보기 (`HistoryDetail`).

### E. 온보딩 (Onboarding.tsx) - `src/pages/Onboarding/Onboarding.tsx`
*   신규 가입 시 최초 진입.
*   기본 정보 입력 후 Body/Mind/Growth 목표를 한 번에 설정.
*   완료 시 자동으로 첫 미션 생성 후 메인 화면으로 이동.

---

## 4. 데이터 모델 (Key Data Models)

*   **User**: `users` 테이블 (Supabase Auth와 연동, 추가 정보는 `profiles` 테이블).
*   **UserGoal**: `user_goals` 테이블. 사용자가 설정한 장기 목표.
*   **Mission**: `missions` 테이블. AI가 생성한 데일리 과제. `proof_type`, `image_url` 등으로 인증 상태 관리.
*   **Friend**: `friends` 테이블. 양방향 친구 관계.
*   **Social**: `goal_likes`, `goal_comments` 테이블.

## 5. 특이 사항 (Notes)
*   **Saju/Naming 기능**: 과거 기획에 있었으나 현재 코드베이스에서는 관련 컴포넌트가 발견되지 않음 (미구현 또는 삭제됨).
*   **AI Generation**: Supabase Edge Functions를 통해 OpenAI API 호출.
*   **Android Sync**: 웹 빌드 후 `npx cap sync android` 명령어로 네이티브 동기화 필요.
