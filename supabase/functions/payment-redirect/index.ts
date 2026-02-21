// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  const url = new URL(req.url);
  const search = url.search;

  const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>Payment Result</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; background-color: #0f172a; color: white; }
      .container { text-align: center; padding: 20px; }
      .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container" id="message">
      <p>앱으로 돌아가는 중입니다...</p>
      <script>
        // Use custom scheme to return to the app
        window.location.href = "myredesign://payment/result" + window.location.search;
        
        // Fallback: If it doesn't automatically redirect
        setTimeout(() => {
          document.getElementById("message").innerHTML = '<p>문제가 발생했거나 앱으로 돌아가지 않는다면 아래 버튼을 눌러주세요.</p><a href="myredesign://payment/result' + window.location.search + '" class="btn">앱 띄우기</a>';
        }, 2000);
      </script>
    </div>
  </body>
</html>`;

  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(html, {
    status: 200,
    headers: headers,
  });
});
