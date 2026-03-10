// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  const url = new URL(req.url);
  const search = url.search;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                // 즉시 이동 시도
                window.location.replace(fallbackUrl);
                // 2.5초 후에도 반응 없으면 버튼 표시
                setTimeout(function() {
                    const msgDiv = document.getElementById("message");
                    if (msgDiv) {
                        msgDiv.innerHTML = '<p>문제가 발생했거나 앱으로 돌아가지 않는다면 아래 버튼을 눌러주세요.</p>' + 
                                         '<a href="' + fallbackUrl + '" class="btn">앱 띄우기</a>';
                    }
                }, 2500);
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
