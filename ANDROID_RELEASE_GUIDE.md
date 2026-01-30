# Android App Release & Play Store Guide

This guide explains how to build your React/Vite app into an Android App Bundle (AAB) and register it on the Google Play Store.

## 1. Prerequisites

- **Node.js** & **npm** (Already installed)
- **Java Development Kit (JDK) 17+**
- **Android Studio** (Required for building the final app)
  - During installation, ensure "Android SDK" and "Android SDK Command-line Tools" are selected.

## 2. Syncing Your Project

Every time you build your web app (`npm run build`), you must sync the changes to the Android native project.

1.  **Build the Web App**:
    ```powershell
    npm run build
    ```
2.  **Sync Capacitor**:
    ```powershell
    npx cap sync
    ```

## 3. Configuring App Icon & Name

- **App Name**: Open `capacitor.config.ts` and change `appName` if needed.
- **App ID**: `com.calamus.myredesign` (This is your unique package name on Play Store).
- **Icons**:
    1.  Install the asset generation tool:
        ```powershell
        npm install @capacitor/assets --save-dev
        ```
    2.  Place your icon file (1024x1024 png) at `assets/icon.png`.
    3.  Generate icons:
        ```powershell
        npx capacitor-assets generate --android
        ```

## 4. Building the Android Bundle (AAB)

The Play Store requires an **Android App Bundle (.aab)**, not an APK.

1.  **Open Android Studio**:
    ```powershell
    npx cap open android
    ```
2.  Wait for Gradle sync to finish (bottom bar in Android Studio).
3.  **Generate Signed Bundle**:
    - Go to **Build** > **Generate Signed Bundle / APK**.
    - Select **Android App Bundle**.
    - Click **Next**.
    - **Key Store Path**: Click "Create new..."
        - Save it somewhere safe (e.g., `my-release-key.jks`).
        - **Password**: Remember this password!
        - **Alias**: `key0` (default) or custom.
    - Click **Next**.
    - Select **Release** build variant.
    - Click **Create**.

**Output**: The `.aab` file will be in `android/app/release/app-release.bundle`.

## 5. Google Play Console Registration

1.  Go to [Google Play Console](https://play.google.com/console).
2.  **Create App**:
    - **App Name**: MyReDesign (or your chosen name).
    - **Default Language**: Korean (or English).
    - **App or Game**: App.
    - **Free or Paid**: Free.
3.  **Dashboard Setup**:
    - Complete the "Set up your app" tasks (Privacy Policy, App Access, Content Ratings, Target Audience, News Apps, etc.).
    - **Privacy Policy**: You must host a privacy policy URL. (You can use a free Github Page or Notion page).

## 6. AdMob Configuration (Crucial)

Since we integrated AdMob:

1.  **App-ads.txt**: Ensure your website (`MyReDesign.ai.kr`) has an `app-ads.txt` file with your publisher ID.
2.  **Play Console "App Content"**:
    - Go to **Policy** > **App Content**.
    - Under **Ads**, select "Yes, my app contains ads".

## 7. Uploading the Release

1.  Go to **Testing** > **Closed testing** (recommended first) or **Production**.
2.  **Create new release**.
3.  Upload the `.aab` file you created in Step 4.
4.  Enter release notes (e.g., "Initial Release").
5.  **Review and Release**: Fix any warnings shown by Google.
6.  Click **Start Rollout**.

## Troubleshooting

- **"Unable to launch Android Studio"**:
    - This means Capacitor couldn't find your Android Studio installation.
    - **Solution**: Open Android Studio manually, select **Open**, and navigate to `c:\calamusAppBuild\MyReDesign_App\android`.
- **"JAVA_HOME is not set"**: Ensure JDK is installed and `JAVA_HOME` environment variable points to it.
- **Gradle Errors**: Often caused by network issues or mismatched SDK versions. Try **File > Sync Project with Gradle Files** in Android Studio.
- **AdMob Ads Not Showing**:
    - Test ads should show immediately with the test ID.
    - Production ads make take 24-48 hours to appear after linking the app in AdMob console.

---

> [!NOTE]
> Since we use `@capacitor-community/admob`, ensure you have updated the `applicationId` (App ID) in your `admob.ts` or AdMob console to match `com.calamus.myredesign`.
