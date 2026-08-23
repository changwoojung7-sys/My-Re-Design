# 🍏 Apple App Store 심사 거절(Guideline 2.1) 대응 및 준비 가이드

본 문서는 **Apple App Store 심사팀의 Guideline 2.1 (Performance: App Completeness) 추가 정보 및 데모 영상 요청**에 대응하기 위해 작성된 **실전 준비 자료 및 수행 방안**입니다.

---

## 📌 1. 심사 거절 사유 분석

- **사유**: `Guideline 2.1 - Information Needed - New App Submission`
- **핵심 요구**:
  애플 심사관이 앱의 주요 기능(회원가입, 결제/구독, 사용자 콘텐츠 관리, 권한 요청 등)이 실제 기기에서 온전히 동작하는지 명확히 확인하기 위해 **실제 기기(iPhone) 화면 녹화 영상(Screen Recording)**과 **7가지 세부 질의에 대한 공식 답변**을 요구하고 있습니다.

---

## 🚀 2. 단계별 수행 방안 (Action Plan)

```
[STEP 1] 심사관 전용 테스트 계정 준비 & 기능 점검 (10분)
   │
[STEP 2] iPhone 16에서 필수 시나리오 화면 녹화 (3~5분)
   │
[STEP 3] 녹화 영상을 '일부 공개' 링크로 업로드 (YouTube or Google Drive) (5분)
   │
[STEP 4] App Store Connect 메시지 회신란에 아래 영문 답변 템플릿 복사 & 제출 (5분)
```

---

## 🎬 3. iPhone 16 화면 녹화 가이드 (필수 포함 시나리오)

> **💡 촬영 팁**: iPhone의 기본 **[제어 센터] ➡️ [화면 기록(녹화)]** 기능을 켜고 아래 순서대로 2~3분 내외로 부드럽게 시연합니다.

### 🎥 필수 포함 시연 루틴 (체크리스트)
1. **앱 실행 및 로그인/회원가입**:
   - 앱 첫 실행 ➡️ 회원가입 또는 이메일 로그인 시연
2. **권한 요청 팝업 허용**:
   - 알림(Notification), 카메라/갤러리 접근 권한 요청 시 팝업 승인
3. **핵심 기능 시연**:
   - 오늘의 미션(Body, Mind, Growth, FunPlay) 선택 및 인증(사진/텍스트 업로드)
4. **인앱 유료 결제/구독 플로우 (★중요)**:
   - `MyPage` 또는 프로모션 배너 ➡️ `MyReDesign Pro` 구독 모달 진입
   - 1개월/3개월/1년 플랜 선택 후 결제창(모바일 KG이니시스) 정상 호출 화면 노출 (실제 결제 승인 직전까지 또는 테스트 결제)
5. **사용자 콘텐츠 신고/차단 (UGC)**:
   - 피드/친구/커뮤니티 게시글의 `신고하기(Report)` 또는 `차단하기(Block)` 버튼 위치 시연
6. **회원 탈퇴 플로우 (Account Deletion)**:
   - `MyPage` ➡️ 계정 관리 ➡️ `회원 탈퇴(Delete Account)` 버튼 및 확인 팝업 시연

---

## 📝 4. App Store Connect 심사관 회신용 영문 답변서 (Copy & Paste)

App Store Connect의 **[앱 심사에 회신]** 입력창에 아래 내용을 그대로 복사하여 제출하세요. (`[여기에 링크 입력]` 부분만 실제 영상 링크로 교체)

```markdown
Dear Apple App Review Team,

Thank you for your review and feedback. We have prepared the requested information and video demonstration to assist you in completing the review of MyReDesign (v1.0.0).

---

### 1. Screen Recording of Core Features
We have recorded a comprehensive walkthrough video on a physical iPhone running iOS 18, demonstrating all requested flows:
- Account creation, login, and account deletion flow
- Accessing premium features and the Pro subscription payment modal
- User-generated content verification and reporting/blocking features
- Permission prompts for push notifications and media library

👉 Video Demonstration Link: [여기에 업로드한 YouTube/Google Drive 링크 입력]

---

### 2. Device Models & OS Tested
- iPhone 16 (iOS 18.0)
- iPhone 15 Pro (iOS 17.5)

---

### 3. App Functions & Target Audience
- **Purpose**: MyReDesign is an AI-powered lifestyle habit OS designed to help individuals build, sustain, and reflect on holistic daily habits across 4 vital pillars: Body (Health), Mind (Mental Wellness), Growth (Productivity/Learning), and FunPlay (Leisure/Creativity).
- **Target Audience**: Modern individuals, professionals, and students seeking structured daily self-improvement and positive wellness routines.

---

### 4. Demo Credentials & Access Instructions
- **Demo Account Email**: demo@myredesign.ai.kr
- **Demo Account Password**: TestPass1234!
- **Guest Access**: Users can also tap "로그인 없이 바로 시작하기" (Start as Guest) on the welcome screen to experience all core mission and tracking loops immediately.
- **Account Deletion Flow**: Accessible anytime via MyPage ➡️ Account Settings ➡️ "회원 탈퇴" (Delete Account).

---

### 5. External Services & Third-Party Platforms
- **AI Engine**: OpenAI API (Used strictly for generating personalized wellness mission prompts and supportive coaching reflections).
- **Backend & Auth**: Supabase (PostgreSQL Database, Auth, and Encrypted Storage with Row Level Security).
- **Payment Gateway**: PortOne / KG Inicis (For subscription pass monetization).
- **Notifications**: Capacitor Local Notifications.

---

### 6. Regional Differences
- The app operates consistently across all regions without regional content locking or geographic restrictions.

---

### 7. Regulated Industry & Credentials
- MyReDesign is a non-medical, self-improvement lifestyle coaching application. It does not provide medical diagnosis, prescription, or regulated financial advice. All AI-generated content is strictly curated for positive lifestyle encouragement.

---

Please let us know if you require any further information. We look forward to your approval.

Sincerely,  
CHANG WOO JUNG  
Developer of MyReDesign
```

---

## 💡 5. 추가 주의사항

1. **동영상 업로드 방식**:
   - **YouTube 일부 공개 (Unlisted)**: 링크가 있는 사람만 볼 수 있도록 설정 (가장 추천, 애플 심사관이 바로 재생 가능)
   - **Google Drive**: 링크가 있는 모든 사용자에게 "뷰어(Viewer)" 권한 부여 필수
2. **테스트 계정 유효성 확인**:
   - Supabase Auth에 `demo@myredesign.ai.kr` / `TestPass1234!` 계정을 미리 생성해 두고 실제 로그인이 되는지 한 번 확인해 두세요.
