# 🤖 MyReDesign (마이 리디자인) Agent Guidelines

## 1. 프로젝트 개요 & 리포지토리 정보

- **앱 이름**: MyReDesign (마이 리디자인)
- **설명**: 건강한 습관을 만들어가는 앱
- **패키지명**: `com.calamus.myredesign`
- **GitHub 프로필**: `changwoojung7-sys`
- **GitHub 저장소**: [https://github.com/changwoojung7-sys/My-Re-Design.git](https://github.com/changwoojung7-sys/My-Re-Design.git)
- **주요 기술 스택**: 
  - **Core Web**: React 19 (Vite), TypeScript, TailwindCSS, Supabase, Zustand
  - **Android**: Capacitor (`android/`)
  - **iOS**: Expo + React Native WebView 래퍼 (`MyReDesign-Expo/` -> `https://myredesign.ai.kr/` 실시간 로드)

---

## 2. 모바일 플랫폼별 아키텍처 및 배포 규칙 (⚠️ 필수 숙지)

### 🍏 iOS 배포 및 동작 방식 (Expo WebView 래퍼)
- iOS 앱은 `MyReDesign-Expo/` 폴더에 위치한 **Expo React Native WebView 래퍼 앱**입니다.
- 앱 실행 시 `https://myredesign.ai.kr/` 실시간 배포 URL을 웹뷰로 로드합니다.
- **실시간 반영 (No Rebuild)**: 웹 코드(React/Vite)를 수정하고 `git push origin main`을 실행하면 웹 서버가 배포되어, **아이폰에 이미 설치된 앱에도 즉시(실시간) 반영**됩니다. (EAS 재빌드 불필요)
- **EAS 클라우드 빌드 (네이티브 변경 시에만 필요)**:
  - 앱 아이콘, 스플래시, 번들 ID 등 네이티브 래퍼 설정이 변경될 때만 실행합니다.
  - 실행 경로: **반드시 `C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo` 폴더로 이동(`cd`) 후 실행**해야 합니다.
  - 명령어: `npx eas build -p ios --profile production --auto-submit`

### 🤖 Android 배포 및 동작 방식 (Capacitor)
- 안드로이드는 루트 경로의 Capacitor(`android/`)를 사용합니다.
- 웹 빌드 후 `npx cap sync android`를 통해 네이티브 동기화를 진행합니다.

---

## 3. 에이전트 핵심 행동 수칙 (Agent Rules)

1. **언어 (Language)**: 모든 응답과 설명은 반드시 **한국어(Korean)**로 작성합니다.
2. **포맷팅 (Formatting)**: 작업/수정/생성이 완료되면 응답 서두 또는 해당 섹션에 **✅ (초록색 체크마크)**를 반드시 포함합니다.
3. **컨텍스트 우선 참조 (Context First)**:
   - iOS 빌드/배포 가이드: `mdfile/IOS 빌드 방법.md`
   - 개발 가이드 및 아키텍처: `mdfile/MyReDesign_AppGuide.md`
   - 상세 구현 현황: `mdfile/Context.md`
   - 리뉴얼 플랜: `mdfile/리뉴얼 플랜.md`
   - 데이터베이스/백엔드 정보: `supabase/` 폴더 및 `mdfile/` 관련 문서 참조
4. **코드 스타일 & 아키텍처 (Code Style)**:
   - TypeScript 타입을 엄격히 정의하고 적용합니다.
   - 스타일링: TailwindCSS 및 CSS 변수 기반 컴포넌트 스타일링
   - 상태 관리: Zustand 스토어 활용
   - 모바일 네이티브 연동: Capacitor 및 Expo WebView 규격 준수
5. **품질 & 완성도**:
   - 모바일 반응형 디자인과 웹/네이티브 환경 모두 고려
   - 직관적이고 깔끔한 UI/UX 구현

---

## 4. 단위 작업 완료 시 자동 Git 배포 워크플로우 (Auto-Push)

모든 단위 작업(기능 추가, 버그 수정, 설정 변경 등)이 완료되면 **사용자가 별도로 요청하지 않아도 에이전트가 자동으로** 아래 3단계를 수행하여 원격에 즉시 반영합니다:

1. `git add .` (모든 변경사항 스테이징)
2. `git commit -m "<작업 내용을 명확하게 명시한 커밋 메시지>"`
3. `git push origin main` (`https://github.com/changwoojung7-sys/My-Re-Design.git` 반영 -> `https://myredesign.ai.kr` 자동 배포)

---

## 5. 자주 사용하는 실행 및 빌드 명령어

- **로컬 웹 개발 서버 실행**: `npm run dev`
- **프로덕션 웹 빌드 (TypeScript 검사 + Vite 빌드)**: `npm run build`
- **Android 빌드 동기화**: `npx cap sync android`
- **Android Studio 열기**: `npx cap open android`
- **iOS EAS 빌드 (MyReDesign-Expo 폴더에서)**: `cd MyReDesign-Expo && npx eas build -p ios --profile production --auto-submit`
- **린트 검사**: `npm run lint`
