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
                            // serverUrl이 /로 끝나고 query가 있으면 적절히 결합
                            if (reloadUrl.endsWith("/")) {
                                reloadUrl += "index.html?" + query;
                            } else {
                                reloadUrl += "?" + query;
                            }
                        }
                        view.loadUrl(reloadUrl);
                    }
                }
            }
        }
    }
}
