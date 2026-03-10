// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  const url = new URL(req.url);
  const search = url.search;

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>Payment Result</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="5;url=myredesign://payment/result${search}"><style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background-color:#0f172a;color:white;}.container{text-align:center;padding:20px;}.btn{display:inline-block;margin-top:20px;padding:12px 24px;background-color:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:bold;}</style></head><body><div class="container" id="message"><p>앱으로 돌아가는 중입니다...</p><script>const search = window.location.search;const intentUrl = "intent://payment/result" + search + "#Intent;scheme=myredesign;package=com.calamus.myredesign;end";const fallbackUrl = "myredesign://payment/result" + search;try {window.location.href = intentUrl;setTimeout(() => {window.location.href = fallbackUrl;}, 100);} catch (e) {window.location.href = fallbackUrl;}setTimeout(() => {const msgDiv = document.getElementById("message");if (msgDiv) {msgDiv.innerHTML = '<p>문제가 발생했거나 앱으로 돌아가지 않는다면 아래 버튼을 눌러주세요.</p><a href="' + fallbackUrl + '" class="btn">앱 띄우기</a>';}}, 3000);</script></div></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });
});
