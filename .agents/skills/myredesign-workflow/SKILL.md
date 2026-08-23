---
name: myredesign-workflow
description: MyReDesign (마이 리디자인) React + Vite + Capacitor + Supabase 앱 개발 및 Git 배포 워크플로우 가이드
---

# 🚀 MyReDesign 개발 & 배포 스킬 가이드

본 스킬은 **MyReDesign (마이 리디자인)** 프로젝트의 개발, 빌드, 데이터베이스 관리, Git 버전 관리 표준 절차를 안내합니다.

## 📌 프로젝트 정보

- **App Name**: MyReDesign (마이 리디자인)
- **GitHub Profile**: `changwoojung7-sys`
- **Repository name**: `My-Re-Design`
- **Repository**: [https://github.com/changwoojung7-sys/My-Re-Design.git]
- **App Stack**: 
  - **Core Web**: React 19 + Vite + TypeScript + TailwindCSS + Supabase + Zustand
  - **Android**: Capacitor (`android/`)
  - **iOS**: Expo + React Native WebView 래퍼 (`MyReDesign-Expo/` -> `https://myredesign.ai.kr/` 실시간 로드)
- **Package ID / Bundle ID**: `com.calamus.myredesign`

---

## 🛠️ 개발 & 플랫폼별 배포 워크플로우

### 1. 개발 서버 실행

- **로컬 웹 개발 서버**:
  ```bash
  npm run dev
  ```

### 2. 플랫폼별 빌드 & 배포 원칙 (⚠️ 필수 숙지)

- **🍏 iOS 배포 (실시간 반영)**:
  - iOS는 `MyReDesign-Expo/`에 있는 **Expo WebView 래퍼 앱**으로, `https://myredesign.ai.kr/`를 실시간으로 로드합니다.
  - 따라서 웹 소스코드를 수정 후 `git push origin main`만 하면 **아이폰 앱에 즉시 자동 반영**됩니다.
  - 앱 아이콘 등 네이티브 래퍼 자체를 새로 빌드할 때만 `cd MyReDesign-Expo` 후 `npx eas build -p ios --profile production --auto-submit`을 실행합니다.

- **🤖 Android 배포**:
  - `npm run build && npx cap sync android` 실행 후 Android Studio를 통해 릴리즈합니다.

### 3. 코드 수정 및 리팩토링 규칙

- TypeScript 타입을 철저히 정의하고 `tsc -b` 검증을 통과해야 합니다.
- 스타일링은 TailwindCSS 클래스 및 컴포넌트 단위 구조화를 원칙으로 합니다.
- 데이터베이스 조회 및 조작은 Supabase Client(`src/lib/supabase.ts` 등)를 사용합니다.
- 전역 상태 관리는 Zustand 스토어를 활용합니다.

### 4. 단위 작업 완료 후 Git 자동 반영

```bash
git add .
git commit -m "작업 내용 설명"
git push origin main
```
