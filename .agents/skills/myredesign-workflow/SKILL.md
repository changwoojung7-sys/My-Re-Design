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
- **App Stack**: React 19 + Vite + TypeScript + TailwindCSS + Supabase + Zustand + Capacitor (Android)
- **Package ID**: `com.calamus.myredesign`

---

## 🛠️ 개발 워크플로우

### 1. 개발 서버 실행

- **로컬 웹 개발 서버**:

  ```bash
  npm run dev
  ```

### 2. 코드 수정 및 리팩토링 규칙

- TypeScript 타입을 철저히 정의하고 `tsc -b` 검증을 통과해야 합니다.
- 스타일링은 TailwindCSS 클래스 및 컴포넌트 단위 구조화를 원칙으로 합니다.
- 데이터베이스 조회 및 조작은 Supabase Client(`src/lib/supabaseClient.ts` 등)를 사용합니다.
- 전역 상태 관리는 Zustand 스토어를 활용합니다.
- 모바일 푸시/알림 및 광고 연동 시 Capacitor 플러그인을 활용합니다.

### 3. 문서 및 데이터베이스 확인

- 아키텍처 및 세부 지침: `mdfile/MyReDesign_AppGuide.md`
- 상세 구현 현황: `mdfile/Context.md`
- 데이터베이스 스키마 및 마이그레이션: `supabase/` 디렉토리

### 4. 빌드 & 배포 절차

- **TypeScript 및 프로덕션 번들 빌드**:

  ```bash
  npm run build
  ```

- **Capacitor Android 동기화**:

  ```bash
  npx cap sync android
  ```

- **빌드 후 Git 반영 및 푸시 (필수 3단계)**:

  ```bash
  git add .
  git commit -m "작업 내용 설명"
  git push origin main
  ```
