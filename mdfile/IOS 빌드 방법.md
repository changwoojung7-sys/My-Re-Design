# 🍏 MyReDesign Expo(EAS) 기반 iOS 프리뷰 빌드 & 정식 배포 가이드

본 가이드는 **Expo + React Native WebView** 래퍼를 활용하여 **iPhone 실기기에서 프리뷰 앱을 직접 설치해 테스트한 후, 정식 App Store에 배포**하는 전체 절차를 안내합니다.

---

## 📁 프로젝트 준비 완료 상태

현재 `C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo` 폴더에 아래 파일들이 자동 구성되었습니다:

- **[App.tsx](file:///c:/calamusAppBuild/MyReDesign_App/MyReDesign-Expo/App.tsx)**: MyReDesign 웹앱을 전체 화면으로 띄우는 WebView 설정
- **[app.json](file:///c:/calamusAppBuild/MyReDesign_App/MyReDesign-Expo/app.json)**: 번들 ID (`com.calamus.myredesign`), 앱 이름, 권한 설정
- **[eas.json](file:///c:/calamusAppBuild/MyReDesign_App/MyReDesign-Expo/eas.json)**: 프리뷰(`preview`) 및 정식 배포(`production`) 빌드 프로필

> **💡 실제 서비스 URL**: [App.tsx](file:///c:/calamusAppBuild/MyReDesign_App/MyReDesign-Expo/App.tsx)의 `TARGET_URL`이 `https://myredesign.ai.kr/` 로 설정되어 있습니다.

---

## 📱 STEP 1: iPhone 실기기 테스트 (프리뷰 빌드)

아이폰 실기기에서 테스트하는 방법은 **두 가지**가 있습니다. 편한 방식을 선택하세요:

---

### [방법 1] QR코드로 실기기에 직접 설치 (Ad-Hoc 내부 배포 - 추천)

1. **내 iPhone 기기 등록 (최초 1회)**:
   터미널(`C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo`)에서 실행:

   ```bash
   cd C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo
   npx eas device:create
   ```

   - 터미널에 **QR코드**와 URL 링크가 나타납니다.
   - 테스트할 **iPhone의 기본 카메라**로 QR코드를 스캔하여 링크를 열고 **설정 프로필을 허용/설치**합니다.
   - Expo가 자동으로 내 iPhone의 UDID를 Apple Developer 계정에 등록해 줍니다.

2. **프리뷰 iOS 빌드 실행**:

   ```bash
   npx eas build -p ios --profile preview
   ```

   - Apple 계정 로그인 및 인증서 생성 질문이 나오면 모두 **`Y`** 를 선택합니다.
   - 빌드가 완료되면 터미널과 이메일로 **설치용 QR코드 및 링크**가 제공됩니다.
   - **iPhone 사파리(Safari)** 로 링크를 열고 **[Install]** 을 누르면 폰에 앱이 즉시 설치됩니다!

---

### [방법 2] Apple TestFlight를 통해 테스트 (정식 환경과 100% 동일)

1. **TestFlight 빌드 및 자동 업로드**:

   ```bash
   npx eas build -p ios --profile production --auto-submit
   ```

2. **iPhone에서 확인**:
   - iPhone에 **TestFlight** 앱(App Store에서 무료 설치)을 엽니다.
   - Apple ID로 초대 메일이 오거나 TestFlight 앱에 `MyReDesign` 앱이 나타나며 바로 설치하여 테스트할 수 있습니다.

---

## 🚀 STEP 2: 폰에서 기능 검증 후 정식 App Store 배포

iPhone에서 웹뷰 로딩, 결제, 네비게이션 동작을 모두 확인한 후:

### 2-1. 정식 프로덕션 빌드 & App Store 제출

```bash
cd C:\calamusAppBuild\MyReDesign_App\MyReDesign-Expo

# App Store 배포용 빌드 및 자동 심사 제출
npx eas build -p ios --profile production --auto-submit
```

*또는 이미 빌드된 최신 바이너리를 제출할 경우:*

```bash
npx eas submit -p ios --latest
```

### 2-2. App Store Connect 최종 심사 요청

1. [App Store Connect](https://appstoreconnect.apple.com) 접속 ➡️ **MyReDesign** 앱 선택
2. **앱 정보, 스크린샷, 가격 및 개인정보처리방침 URL** 입력
3. 업로드된 빌드 버전을 선택하고 **심사에 추가** ➡️ **심사 제출** 클릭

---

## 🛠️ 자주 쓰는 명령어 모음

| 목적 | 터미널 명령어 (MyReDesign-Expo 폴더에서 실행) |
| --- | --- |
| **EAS 프로젝트 초기화** | `npx eas project:init` |
| **테스트 기기 등록** | `npx eas device:create` |
| **실기기 프리뷰 빌드 (Ad-Hoc)** | `npx eas build -p ios --profile preview` |
| **정식 배포 빌드 (App Store)** | `npx eas build -p ios --profile production` |
| **빌드 & App Store 자동 제출** | `npx eas build -p ios --profile production --auto-submit` |
| **최신 빌드 수동 제출** | `npx eas submit -p ios --latest` |

---

## 🔒 프로젝트 연동 정보 (참고용)

- **Bundle ID**: `com.calamus.myredesign`
- **Apple Team ID**: `F9B99R2LMT` (`CHANG WOO JUNG`)
- **ASC App ID**: `6804119146`
- **Expo Project ID**: `4557a7fb-d8d2-4506-a1d1-50777bc1a7f6`
- **App Store Connect API Key ID**: `6J83MYVP29` ([Expo] EAS Submit)
- **최신 프로덕션 빌드 번호**: `1.0.0 (Build 2)`

