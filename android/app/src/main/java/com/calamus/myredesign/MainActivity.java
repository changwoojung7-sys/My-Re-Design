package com.calamus.myredesign;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.net.URISyntaxException;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Capacitor 기본 BridgeWebViewClient를 확장하여 intent:// 스키마 등을 제어
        this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
            
            // --- [NEW] Payment Redirect Interceptor (MAXIMUM: shouldInterceptRequest) ---
            // PG사의 리다이렉트를 가장 밑바닥 네트워크 계층에서 아예 끊어버립니다. (화면 까매짐 100% 차단)
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url != null && url.contains("/functions/v1/payment-redirect")) {
                    Uri redirectUri = Uri.parse(url);
                    // 한글 등 특수문자 깨짐을 방지하기 위해 인코딩된 원본 쿼리를 그대로 가져옴
                    String query = redirectUri.getEncodedQuery(); 
                    
                    String serverUrl = bridge.getServerUrl();
                    if (serverUrl != null) {
                        String reloadUrl = serverUrl;
                        if (query != null && !query.isEmpty()) {
                            if (!reloadUrl.endsWith("/")) {
                                reloadUrl += "/";
                            }
                            reloadUrl += "?" + query;
                        }
                        // UI 스레드로 보내서 앱 로컬 화면으로 강제 이동
                        final String finalReloadUrl = reloadUrl;
                        view.post(() -> view.loadUrl(finalReloadUrl));
                    }
                    
                    // 버그 픽스: null을 반환하면 안드로이드가 실제 네트워크 응답의 HTML 코드를 텍스트로 읽어버림
                    // 안전한 텅 빈 HTML을 스트림으로 주입하여 완벽한 방어막을 칩니다.
                    String emptyHtml = "<html><head></head><body style=\"background-color:#111827;\"></body></html>";
                    java.io.InputStream dummyData = new java.io.ByteArrayInputStream(emptyHtml.getBytes(java.nio.charset.StandardCharsets.UTF-8));
                    return new android.webkit.WebResourceResponse("text/html", "UTF-8", dummyData);
                }
                return super.shouldInterceptRequest(view, request);
            }

            // (결제 관련) 보조 안전장치: 혹시라도 넘어간다면 로딩 시작 시점에서 한 번 더 방어
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (url != null && url.contains("/functions/v1/payment-redirect")) {
                    // 즉각 까만 창의 로딩 자체를 강제 정지
                    view.stopLoading();
                    
                    Uri redirectUri = Uri.parse(url);
                    String query = redirectUri.getQuery();
                    
                    String serverUrl = bridge.getServerUrl();
                    if (serverUrl != null) {
                        String reloadUrl = serverUrl;
                        if (query != null && !query.isEmpty()) {
                            if (!reloadUrl.endsWith("/")) {
                                reloadUrl += "/";
                            }
                            reloadUrl += "?" + query;
                        }
                        // 끊어낸 뒤 로컬 앱 뷰로 쿼리를 붙여 덮어씌우기
                        final String finalReloadUrl = reloadUrl;
                        view.post(() -> view.loadUrl(finalReloadUrl));
                    }
                    return; // 더 이상 진행 방지
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                
                // 앱 내부 커스텀 스키마 (myredesign://) 직접 처리
                if (url.startsWith("myredesign://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.setPackage(getPackageName()); // 현재 앱으로 명시적 타겟팅
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                // 외부 앱 (앱카드 등) 호출 인텐트 캡처
                if (url.startsWith("intent:") || url.startsWith("market:") || url.startsWith("ispmobile:")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            startActivity(intent);
                            return true; // 외부 앱 실행 (웹뷰 내부 라우팅 중단)
                        }
                    } catch (URISyntaxException e) {
                        e.printStackTrace();
                    } catch (Exception e) {
                        // 앱이 설치되어 있지 않은 경우 fallback_url 또는 마켓으로 자동 이동
                        if (url.startsWith("intent:")) {
                            try {
                                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                                String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                                if (fallbackUrl != null) {
                                    view.loadUrl(fallbackUrl);
                                    return true;
                                } else {
                                    String packagename = intent.getPackage();
                                    if (packagename != null) {
                                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packagename)));
                                        return true;
                                    }
                                }
                            } catch (Exception ex) {
                                ex.printStackTrace();
                            }
                        }
                    }
                }
                
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    // 딥링크 복귀 시 웹뷰 하얀화면 복구 처리
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) {
            Uri uri = intent.getData();
            // 외부 결제 후 'myredesign://...' 스키마로 복귀 시 유실된 브릿지 세션을 복구
            if ("myredesign".equals(uri.getScheme())) {
                WebView view = this.bridge.getWebView();
                if (view != null) {
                    String serverUrl = this.bridge.getServerUrl();
                    if (serverUrl != null) {
                        String query = uri.getQuery();
                        String reloadUrl = serverUrl;
                        if (query != null && !query.isEmpty()) {
                            if (!reloadUrl.endsWith("/")) {
                                reloadUrl += "/";
                            }
                            reloadUrl += "?" + query;
                        }
                        view.loadUrl(reloadUrl);
                    }
                }
            }
        }
    }
}
