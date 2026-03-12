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
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                
                // --- [NEW] Payment Redirect Interceptor ---
                // 외부 PG사에서 결제가 끝나고 리다이렉트될 때, Edge Function HTML 렌더링에 의한
                // '까만 화면' 이슈를 겪지 않도록 안드로이드 단에서 찰나의 순간에 쿼리를 들고 앱(로컬)으로 강제 복귀시킵니다.
                if (url.contains("/functions/v1/payment-redirect")) {
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
                        // UI 스레드 안전성 확보를 위해 post 내부에서 loadUrl 호출
                        final String finalReloadUrl = reloadUrl;
                        view.post(() -> view.loadUrl(finalReloadUrl));
                        return true; // 외부 Edge Function 페이지 접속을 차단하고 낚아챔 완료
                    }
                }

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
