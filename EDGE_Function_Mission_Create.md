create table public.mission_fingerprint (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  mission_date date not null,
  category text not null check (
    category in (
      'body_wellness',
      'growth_career',
      'mind_connection',
      'funplay'
    )
  ),

  pattern_id text not null,

  primary_action text not null,        -- 핵심 동사 (예: 기록, 정의, 조정, 관찰)
  tool text,                           -- phone, paper, none, etc
  place text,                          -- home, office, outdoor, commute
  social_context text,                  -- alone, with_people, either
  sense_tag text,                      -- visual, auditory, physical, cognitive, etc

  difficulty_level text,               -- optional (funplay용)
  mechanic text,                       -- funplay mechanic (nullable)

  created_at timestamptz default now(),

  constraint uq_user_date_category unique (user_id, mission_date, category)
);

create index idx_mission_fp_user_date
on public.mission_fingerprint(user_id, mission_date desc);

create index idx_mission_fp_user_category
on public.mission_fingerprint(user_id, category);

create index idx_mission_fp_pattern
on public.mission_fingerprint(user_id, pattern_id);

create index idx_mission_fp_action
on public.mission_fingerprint(user_id, primary_action);

# 7일치 미션 핑거프린트 조회 쿼리 참조.
select *
from mission_fingerprint
where user_id = $1
  and mission_date >= current_date - interval '7 days';


✅ 4️⃣ RLS 정책 (보안 필수)
alter table public.mission_fingerprint enable row level security;

create policy "Users can read own fingerprints"
on public.mission_fingerprint
for select
using (auth.uid() = user_id);

create policy "Users can insert own fingerprints"
on public.mission_fingerprint
for insert
with check (auth.uid() = user_id);

create policy "Users can delete own fingerprints"
on public.mission_fingerprint
for delete
using (auth.uid() = user_id);

5️⃣ Edge Function에서 쓰는 실제 흐름
1️⃣ 최근 7일 fingerprint 조회 로직 예제
const { data: recent } = await supabase
  .from("mission_fingerprint")
  .select("pattern_id, primary_action, tool, place, mechanic")
  .eq("user_id", userId)
  .gte("mission_date", sevenDaysAgo);

2️⃣ 이걸 프롬프트에 넣는 fingerprint 요약
recent_primary_actions = recent.map(r => r.primary_action)
recent_patterns = recent.map(r => r.pattern_id)
recent_tools = recent.map(r => r.tool)

3️⃣ 미션 생성 성공 후 insert
await supabase.from("mission_fingerprint").insert({
  user_id: userId,
  mission_date: today,
  category,
  pattern_id,
  primary_action,
  tool,
  place,
  social_context,
  sense_tag,
  mechanic
});

✅ 4️⃣ Edge Function 코드 예시 (JWT 인증 + 3회 제한 + OpenAI 호출)
아래 코드는 구조 골격이자 “바로 작동” 목적의 예시야.
DB 테이블: mission_refresh_log, mission_fingerprint, missions(네가 쓰는 저장 테이블명에 맞춰 수정)

// supabase/functions/generate-missions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---- 환경변수 ----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// 간단 유틸
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    // 1) JWT 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    // client for auth check (anon)
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // service role client (DB write 권한)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2) 요청 파라미터
    const body = await req.json().catch(() => ({}));
    const category = body.category ?? "daily_batch"; 
    // category: "daily_batch"(3개) or "funplay" or 단일 카테고리 등 네 정책대로

    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const missionDate = `${yyyy}-${mm}-${dd}`; // UTC 기준. KST로 쓰려면 서버에서 변환 권장

    // 3) 새로고침 제한 (하루 3회)
    // "generate"도 refresh_count로 볼지, "refresh=true"일 때만 카운트할지 정책 선택 가능
    const isRefresh = body.refresh === true;

    if (isRefresh) {
      const { data: row } = await supabase
        .from("mission_refresh_log")
        .select("*")
        .eq("user_id", userId)
        .eq("category", category)
        .eq("mission_date", missionDate)
        .maybeSingle();

      if (row && row.refresh_count >= 3) {
        return json({
          status: "refresh_limit_reached",
          remaining_refresh: 0,
        });
      }

      if (row) {
        await supabase
          .from("mission_refresh_log")
          .update({
            refresh_count: row.refresh_count + 1,
            last_refresh_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else {
        await supabase.from("mission_refresh_log").insert({
          user_id: userId,
          category,
          mission_date: missionDate,
          refresh_count: 1,
          last_refresh_at: new Date().toISOString(),
        });
      }
    }

    // 4) (선택) 유저 목표/프로필/히스토리 fingerprint 조회
    // 네 테이블명에 맞춰 수정
    const { data: profile } = await supabase
      .from("profiles")
      .select("age, gender, goal_body_wellness, goal_growth_career, goal_mind_connection, language")
      .eq("id", userId)
      .single();

    const { data: fp } = await supabase
      .from("mission_fingerprint")
      .select("category, pattern_id, primary_action, tool, place, social_context, mechanic")
      .eq("user_id", userId)
      .gte("mission_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));

    // 5) 프롬프트 구성(속도 최적화: fingerprint만)
    const fingerprint = fp ?? [];
    const recentVerbs = Array.from(new Set(fingerprint.map((x: any) => x.primary_action).filter(Boolean)));
    const recentPatterns = Array.from(new Set(fingerprint.map((x: any) => x.pattern_id).filter(Boolean)));
    const recentTools = Array.from(new Set(fingerprint.map((x: any) => x.tool).filter(Boolean)));
    const recentPlaces = Array.from(new Set(fingerprint.map((x: any) => x.place).filter(Boolean)));

    // 6) OpenAI 호출 (여기서는 예시로 “3개 배치 생성”)
    const system = `You are MyReDesign Mission Composer. Output strictly valid JSON only.`;
    const user = {
      user: {
        age: profile?.age ?? null,
        gender: profile?.gender ?? null,
        language: profile?.language ?? "ko",
        goals: {
          body_wellness: profile?.goal_body_wellness ?? "",
          growth_career: profile?.goal_growth_career ?? "",
          mind_connection: profile?.goal_mind_connection ?? "",
        },
      },
      fingerprint: {
        recent_verbs: recentVerbs,
        recent_patterns: recentPatterns,
        recent_tools: recentTools,
        recent_places: recentPlaces,
      },
      task: "Generate 3 missions: body_wellness, growth_career, mind_connection. Each < 3 minutes. Avoid repeats.",
    };

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",     // 너가 쓰는 모델로 변경
        temperature: 1.0,
        top_p: 0.9,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      return json({ error: "OpenAI API failed", detail: errText }, 500);
    }

    const openaiJson = await openaiResp.json();
    const content = openaiJson.choices?.[0]?.message?.content ?? "{}";

    // 7) JSON 파싱 + 저장 (필요시)
    let missions;
    try {
      missions = JSON.parse(content);
    } catch {
      return json({ error: "Invalid JSON from model", raw: content }, 500);
    }

    // (선택) missions 저장 로직 (네 DB 스키마에 맞게)
    // await supabase.from("missions").upsert(...)

    // 8) remaining_refresh 계산
    let remaining = null;
    if (isRefresh) {
      const { data: row2 } = await supabase
        .from("mission_refresh_log")
        .select("refresh_count")
        .eq("user_id", userId)
        .eq("category", category)
        .eq("mission_date", missionDate)
        .maybeSingle();
      remaining = row2 ? Math.max(0, 3 - row2.refresh_count) : 3;
    }

    return json({
      status: "ok",
      mission_date: missionDate,
      remaining_refresh: remaining,
      missions,
    });
  } catch (e) {
    return json({ error: "Server error", detail: String(e) }, 500);
  }
});

5) 클라이언트 호출 (React)
const { data, error } = await supabase.functions.invoke("generate-missions", {
  body: { category: "daily_batch", refresh: true }
});

funplay만 따로면 category: "funplay" 로 호출하고, 함수 내부에서 분기하면 됨.