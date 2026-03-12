// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  const url = new URL(req.url);
  const search = url.search;

  const userAgent = req.headers.get('user-agent') || '';
  const isAndroid = /android/i.test(userAgent);

  // 안드로이드인 경우: HTML 렌더링을 완전히 생략하고 안드로이드 전용 intent:// 딥링크로 즉시 302 리다이렉트
  // 안드로이드 OS의 인텐트 해석기가 이를 가로채 아무런 웹뷰 번쩍임 없이 앱의 MainActivity로 바로 전달함.
  if (isAndroid) {
    const intentUrl = `intent://payment/result${search}#Intent;scheme=myredesign;package=com.calamus.myredesign;end`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": intentUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // iOS 및 웹 환경을 위한 Fallback HTML (기존 방식 유지)
  const fallbackUrl = `myredesign://payment/result${search}`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="3;url=${fallbackUrl}">
    <title>Payment Result</title>
    <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: -apple-system, sans-serif; background-color: #0f172a; color: white; }
        .container { text-align: center; padding: 20px; }
        .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container" id="message">
        <p>앱으로 돌아가는 중입니다...</p>
        <script>
            (function() {
                const search = window.location.search;
                const fallbackUrl = "myredesign://payment/result" + search;
                // 바로 앱 스키마 호출
                window.location.replace(fallbackUrl);
                
                // 3초 후에도 반응 없으면 (웹, iOS 브라우저 멈춤 등) 버튼 표시
                setTimeout(function() {
                    const msgDiv = document.getElementById("message");
                    if (msgDiv) {
                        msgDiv.innerHTML = '<p>앱으로 자동으로 돌아가지 않나요?</p>' + 
                                         '<a href="' + fallbackUrl + '" class="btn">앱 띄우기</a>';
                    }
                }, 3000);
            })();
        </script>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
