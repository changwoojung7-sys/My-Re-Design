package com.calamus.myredesign;

import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.os.Message;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeWebChromeClient;

import java.net.URISyntaxException;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MYREDESIGN";

    // ──────────────────────────────────────────────────
    // [수정 1] 팝업 WebView와 Dialog를 멤버 변수로 관리
    // ──────────────────────────────────────────────────
    private WebView popupWebView;
    private Dialog popupDialog;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final Bridge bridge = this.bridge;
        if (bridge == null || bridge.getWebView() == null) {
            Log.w(TAG, "Bridge or WebView is null in onCreate");
            return;
        }

        WebView webView = bridge.getWebView();

        // --- 결제 연동을 위한 WebView 설정 최적화 ---
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true); // 팝업창 및 PG 내부 팝업 대응
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new SafePaymentWebViewClient(bridge));

        webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {

            // ──────────────────────────────────────────────────────────────
            // [수정 2] onCreateWindow: 새 WebView를 만들어 Dialog에 넣고 표시
            // KG이니시스는 window.open()으로 팝업을 띄우므로
            // 반드시 신규 WebView 인스턴스가 필요합니다.
            // 기존 코드처럼 transport.setWebView(view)를 사용하면
            // 메인 WebView 자체가 결제 URL로 덮여서 복귀 불가.
            // ──────────────────────────────────────────────────────────────
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                    boolean isUserGesture, Message resultMsg) {
                Log.d(TAG, "onCreateWindow: creating popup WebView in Dialog");

                // 이전에 혹시 남은 팝업이 있으면 먼저 정리
                dismissPopup();

                // 1) 새 WebView 생성 & 기본 설정
                popupWebView = new WebView(MainActivity.this);
                WebSettings ps = popupWebView.getSettings();
                ps.setJavaScriptEnabled(true);
                ps.setJavaScriptCanOpenWindowsAutomatically(true);
                ps.setSupportMultipleWindows(true);
                ps.setDomStorageEnabled(true);
                ps.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                ps.setUserAgentString(view.getSettings().getUserAgentString());

                // 2) 팝업 WebView 에도 URL 인터셉터 설정
                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView wv, WebResourceRequest req) {
                        String url = req.getUrl() != null ? req.getUrl().toString() : "";
                        Log.d(TAG, "popup shouldOverrideUrlLoading = " + url);

                        // 결제 완료/취소 후 redirect 처리
                        if (url.contains("/functions/v1/payment-redirect")
                                || url.startsWith("myredesign://payment/result")) {
                            dismissPopup();
                            handlePaymentRedirect(url);
                            return true;
                        }

                        // intent: / market: / ispmobile: 외부 앱 처리
                        if (url.startsWith("intent:")) {
                            // 외부 메서드나 헬퍼를 통해 처리 가능하게 메서드 위치 공유 필요
                            launchExternalIntent(url);
                            return true;
                        }
                        if (url.startsWith("market:") || url.startsWith("ispmobile:")) {
                            launchExternalIntent(url);
                            return true;
                        }

                        // window.close()가 트리거하는 about:blank 등은 팝업 닫기로 처리
                        if (url.equals("about:blank")) {
                            dismissPopup();
                            return true;
                        }

                        return false; // 나머지는 팝업 WebView 내부에서 로드
                    }
                });

                // 3) 팝업 WebView 의 ChromeClient (window.close() 처리)
                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        Log.d(TAG, "popup onCloseWindow: dismissing dialog");
                        dismissPopup();
                    }
                });

                // 4) Dialog 생성 — 전체화면 스타일
                popupDialog = new Dialog(MainActivity.this,
                        android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                popupDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
                popupDialog.setContentView(popupWebView,
                        new ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT));
                popupDialog.setOnDismissListener(d -> {
                    // Dialog가 닫힐 때(뒤로가기 포함) WebView 자원 해제
                    Log.d(TAG, "popupDialog onDismiss");
                    cleanupPopupWebView();
                });
                popupDialog.show();

                // 5) transport 에 새 WebView 연결 (핵심 수정)
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }

            // ──────────────────────────────────────────────────────────────
            // [수정 3] onCloseWindow: 메인 WebView 가 아닌 팝업 Dialog 닫기
            // ──────────────────────────────────────────────────────────────
            @Override
            public void onCloseWindow(WebView window) {
                Log.d(TAG, "main onCloseWindow intercepted");
                // 팝업이 열려있으면 팝업만 닫기, 메인 앱은 그대로 유지
                if (popupDialog != null && popupDialog.isShowing()) {
                    dismissPopup();
                } else {
                    // 팝업이 없는 경우만 기존 super 호출 (Capacitor 처리)
                    super.onCloseWindow(window);
                }
            }

            @Override
            public boolean onJsAlert(WebView view, String url,
                    String message, JsResult result) {
                Log.d(TAG, "onJsAlert: " + message);
                return super.onJsAlert(view, url, message, result);
            }

            @Override
            public boolean onJsConfirm(WebView view, String url,
                    String message, JsResult result) {
                Log.d(TAG, "onJsConfirm: " + message);
                return super.onJsConfirm(view, url, message, result);
            }
        });
    }

    // ──────────────────────────────────────────────────────────────
    // [수정 4] onBackPressed: 팝업이 열려있으면 팝업만 닫기
    // ──────────────────────────────────────────────────────────────
    @Override
    public void onBackPressed() {
        // 팝업 Dialog가 열려있으면 팝업만 닫고 메인 앱으로 복귀
        if (popupDialog != null && popupDialog.isShowing()) {
            Log.d(TAG, "Back pressed: dismissing popup dialog");
            dismissPopup();
            return;
        }

        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            String currentUrl = webView.getUrl();
            boolean isExternal = currentUrl != null
                    && !currentUrl.contains("localhost")
                    && !currentUrl.contains("127.0.0.1")
                    && !currentUrl.startsWith("file://");
            if (isExternal) {
                Log.d(TAG, "Back pressed on external page. Restoring app.");
                restoreApp(webView);
                return;
            }
        }
        super.onBackPressed();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null)
            return;

        setIntent(intent);

        if (this.bridge != null) {
            this.bridge.onNewIntent(intent);
        }

        Uri data = intent.getData();
        Log.d(TAG, "onNewIntent data = " + (data != null ? data : "(none)"));
    }

    // ──────────────────────────────────────────────────────────────
    // 팝업 Dialog 및 WebView 정리 헬퍼
    // ──────────────────────────────────────────────────────────────
    private void dismissPopup() {
        runOnUiThread(() -> {
            if (popupDialog != null) {
                popupDialog.setOnDismissListener(null); // 리스너 해제 후 dismiss
                popupDialog.dismiss();
                popupDialog = null;
            }
            cleanupPopupWebView();
        });
    }

    private void cleanupPopupWebView() {
        if (popupWebView != null) {
            popupWebView.stopLoading();
            popupWebView.loadUrl("about:blank");
            popupWebView.destroy();
            popupWebView = null;
        }
    }

    private void restoreApp(WebView view) {
        if (this.bridge == null || view == null)
            return;

        String serverUrl = this.bridge.getServerUrl();
        if (serverUrl == null || serverUrl.isEmpty()) {
            serverUrl = "http://localhost";
        }
        final String finalUrl = serverUrl;
        Log.d(TAG, "Restoring app UI: " + finalUrl);
        view.post(() -> view.loadUrl(finalUrl));
    }

    // ──────────────────────────────────────────────────────────────
    // 결제 redirect 처리 (팝업/메인 양쪽에서 호출)
    // ──────────────────────────────────────────────────────────────
    private void handlePaymentRedirect(String url) {
        try {
            Uri originalUri = Uri.parse(url);
            String query = originalUri.getEncodedQuery();
            String newUrl = "myredesign://payment/result" + (query != null ? "?" + query : "");

            Intent resultIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(newUrl));
            resultIntent.setPackage(getPackageName());
            resultIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(resultIntent);
        } catch (Exception e) {
            Log.e(TAG, "handlePaymentRedirect error", e);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 외부 앱 실행 공통 헬퍼 (intent 스킴 포함)
    // ──────────────────────────────────────────────────────────────
    private boolean handleIntentScheme(WebView view, String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            if (intent == null)
                return true;

            try {
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
                    Log.d(TAG, "Loading browser_fallback_url = " + fallbackUrl);
                    view.loadUrl(fallbackUrl);
                    return true;
                }
                String packageName = intent.getPackage();
                if (packageName != null && !packageName.isEmpty()) {
                    startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse("market://details?id=" + packageName)));
                    return true;
                }
                Log.w(TAG, "No fallbackUrl or packageName for intent url");
                return true;
            }
        } catch (URISyntaxException e) {
            Log.e(TAG, "Invalid intent URI: " + url, e);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "handleIntentScheme error: " + url, e);
            return true;
        }
    }

    private boolean launchExternalIntent(String url) {
        if (url.startsWith("intent:")) {
            return handleIntentScheme(null, url);
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch external intent: " + url, e);
            return true;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 메인 WebView 용 WebViewClient
    // ──────────────────────────────────────────────────────────────
    private class SafePaymentWebViewClient extends BridgeWebViewClient {
        private final Bridge bridge;

        SafePaymentWebViewClient(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String url = uri != null ? uri.toString() : "";
            Log.d(TAG, "shouldOverrideUrlLoading = " + url);

            // 1) 결제 redirect (Edge Function URL 또는 커스텀 스킴)
            if (url.contains("/functions/v1/payment-redirect")
                    || url.startsWith("myredesign://payment/result")) {
                Log.d(TAG, "Intercepted payment redirect: " + url);

                if (popupDialog != null && popupDialog.isShowing()) {
                    dismissPopup();
                }

                // ── 핵심 실행 순서 ─────────────────────────────────────
                // 1) restoreApp()으로 WebView를 localhost(React 앱)로 먼저 복원
                // 2) React가 마운트되고 appUrlOpen 리스너가 등록될 때까지 대기
                // 3) 그 이후 handlePaymentRedirect()로 deeplink intent 발송
                // ※ 순서가 바뀌면 React 리스너 미등록 상태에서 이벤트 유실 → 하얀 화면
                restoreApp(view);

                final String redirectUrl = url;
                view.postDelayed(() -> {
                    Log.d(TAG, "Delayed handlePaymentRedirect: " + redirectUrl);
                    handlePaymentRedirect(redirectUrl);
                }, 2000); // React 마운트 완료 대기 (2초)

                return true;
            }

            // 2) 외부 결제앱 intent: 처리
            if (url.startsWith("intent:")) {
                boolean handled = handleIntentScheme(view, url);
                if (handled && (popupDialog == null || !popupDialog.isShowing())) {
                    // 메인 WebView 에서 외부앱 이동 시에만 화면 복원
                    restoreApp(view);
                }
                return handled;
            }

            if (url.startsWith("market:") || url.startsWith("ispmobile:")) {
                return launchExternalIntent(url);
            }

            // 3) 커스텀 스킴은 Manifest + onNewIntent 에서 처리하므로 무시
            if (url.startsWith("myredesign://")) {
                Log.d(TAG, "Custom scheme: handled by Activity/App API");
                return true;
            }

            return super.shouldOverrideUrlLoading(view, request);
        }

        // ──────────────────────────────────────────────────────────────
        // [수정 6] onPageStarted에서 stopLoading() 제거
        // shouldOverrideUrlLoading 이 이미 redirect를 차단하므로
        // 여기서 중단하면 정상 페이지 로드까지 끊길 수 있습니다.
        // ──────────────────────────────────────────────────────────────
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Log.d(TAG, "onPageStarted = " + url);
            // payment-redirect URL은 shouldOverrideUrlLoading에서 이미 차단됨
            // 여기서 stopLoading()을 추가로 호출하면 정상 흐름이 끊길 수 있으므로 제거
            super.onPageStarted(view, url, favicon);
        }

        private boolean launchExternalIntent(String url) {
            return MainActivity.this.launchExternalIntent(url);
        }
    }
}
