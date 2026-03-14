package com.calamus.myredesign;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.os.Message;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeWebChromeClient;

import java.net.URISyntaxException;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MYREDESIGN";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = bridge.getWebView();
        
        // --- 결제 연동을 위한 WebView 설정 최적화 ---
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true); // 팝발창 및 PG 내부 팝업 대응
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new SafePaymentWebViewClient(bridge));
        
        // Window.close() 및 팝업창을 현재 창에서 처리하기 위한 WebChromeClient 설정
        webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onCloseWindow(WebView window) {
                super.onCloseWindow(window);
                Log.d(TAG, "onCloseWindow intercepted. Restoring app.");
                restoreApp(window);
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // 새 창(팝업) 요청 시 현재 웹뷰에서 그대로 열리도록 설정 (결제창 대응)
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(view);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }

    private void restoreApp(WebView view) {
        if (this.bridge != null) {
            view.post(() -> view.loadUrl(this.bridge.getServerUrl()));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (intent == null) {
            return;
        }

        // 매우 중요: 현재 액티비티의 intent 갱신
        setIntent(intent);

        // 매우 중요: Capacitor App API(appUrlOpen / getLaunchUrl)로 전달
        if (this.bridge != null) {
            this.bridge.onNewIntent(intent);
        }

        Uri data = intent.getData();
        if (data != null) {
            Log.d(TAG, "onNewIntent data = " + data);
        } else {
            Log.d(TAG, "onNewIntent with no data");
        }
    }

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

            // 1) PG redirect 결과 HTML을 웹뷰 내부에서 보여주지 않음
            //    여기서 강제 loadUrl 하지 말고, JS에서 딥링크 / resume 로 복구
            if (url.contains("/functions/v1/payment-redirect") || url.startsWith("myredesign://payment/result")) {
                Log.d(TAG, "Intercepted payment redirect. Restoring app and firing intent: " + url);
                try {
                    Uri originalUri = Uri.parse(url);
                    String query = originalUri.getEncodedQuery();

                    // myredesign:// 스킴을 앱 자체에서 바로 생성 (Edge Function 폴백 대체)
                    String newUrl = "myredesign://payment/result" + (query != null ? "?" + query : "");
                    Intent resultIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(newUrl));
                    resultIntent.setPackage(getPackageName()); // 본인 패키지명 지정
                    resultIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                    // 중요 1: WebView 빈 화면이나 리다이렉션 무한루프를 막고 초기 로컬 URL(React App)로 강제 복원
                    restoreApp(view);

                    // 중요 2: Intent를 실행하여 MainActivity의 onNewIntent 가 호출되고 -> appUrlOpen 이벤트를 발생시킴
                    startActivity(resultIntent);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to parse payment redirect inside WebView", e);
                }
                return true;
            }

            // 2) 외부 결제앱 호출 인텐트 처리
            if (url.startsWith("intent:")) {
                boolean handled = handleIntentScheme(view, url);
                if (handled) {
                    // 외부 앱 이동 시 웹뷰 화면을 미리 앱 홈으로 돌려놓아 복귀 시 하얀 화면 방지
                    restoreApp(view);
                }
                return handled;
            }

            if (url.startsWith("market:") || url.startsWith("ispmobile:")) {
                return launchExternalIntent(url);
            }

            // 3) 우리 앱 스킴은 여기서 다시 startActivity 하지 않음
            //    Manifest + onNewIntent + Capacitor App API로만 처리
            if (url.startsWith("myredesign://")) {
                Log.d(TAG, "Ignore custom scheme inside WebView; Activity/App API will handle it");
                return true;
            }

            return super.shouldOverrideUrlLoading(view, request);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Log.d(TAG, "onPageStarted = " + url);

            // 혹시라도 redirect html이 열리기 시작하면 중단
            if (url != null && url.contains("/functions/v1/payment-redirect")) {
                view.stopLoading();
                Log.d(TAG, "Stopped loading payment redirect page");
                return;
            }

            super.onPageStarted(view, url, favicon);
        }

        private boolean handleIntentScheme(WebView view, String url) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent == null) {
                    return true;
                }

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
                        Intent marketIntent = new Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse("market://details?id=" + packageName)
                        );
                        startActivity(marketIntent);
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
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch external intent: " + url, e);
                return true;
            }
        }
    }
}
