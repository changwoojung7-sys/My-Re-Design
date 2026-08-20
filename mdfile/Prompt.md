# 🎯 MyReDesign — 미션 생성 프로세스 전체 문서

> **최종 업데이트: 2026-02-16**
> 
> 이 문서는 MyReDesign 앱의 미션 생성 파이프라인을 **클라이언트 호출 → Edge Function → AI 프롬프트 → 응답 처리 → DB 저장**까지 전 과정을 상세히 기술합니다.

---

## 📌 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [클라이언트 호출 (openai.ts)](#2-클라이언트-호출)
3. [Edge Function 처리 (index.ts)](#3-edge-function-처리)
4. [패턴 라이브러리 (mission-patterns.json)](#4-패턴-라이브러리)
5. [Daily Missions 프롬프트](#5-daily-missions-프롬프트)
6. [FunPlay 미션 프롬프트](#6-funplay-미션-프롬프트)
7. [Coaching 프롬프트](#7-coaching-프롬프트)
8. [응답 처리 & 저장](#8-응답-처리--저장)
9. [어학 목표 자동 감지](#9-어학-목표-자동-감지)
10. [디버깅 & 배포 가이드](#10-디버깅--배포-가이드)

---

## 1. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────┐
│                     Client (React App)                       │
│                                                              │
│  Today.tsx → openai.ts → supabase.functions.invoke()         │
│        ↓              ↓                                      │
│  generateMissions()   generateFunPlayMission()               │
│  generateCoaching()                                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP POST (JWT Auth)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Supabase Edge Function                          │
│              generate-mission/index.ts                       │
│                                                              │
│  1. JWT 인증                                                 │
│  2. Refresh 횟수 확인 (max 3/day)                            │
│  3. 히스토리 조회 (mission_fingerprint, 7일)                 │
│  4. 사용자 목표 조회 (user_goals)                            │
│  5. 패턴 라이브러리에서 랜덤 선택                            │
│  6. 프롬프트 조립 (System + User)                            │
│  7. OpenAI API 호출 (gpt-4o-mini)                            │
│  8. 응답 파싱 → Fingerprint 저장 → 클라이언트 반환           │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    OpenAI API                                │
│              Model: gpt-4o-mini                              │
│         Response Format: JSON Object                         │
└──────────────────────────────────────────────────────────────┘
```

### 핵심 파일 위치

| 파일 | 경로 | 역할 |
|------|------|------|
| 클라이언트 호출 | `src/lib/openai.ts` | Edge Function 호출 + 폴백 처리 |
| Edge Function | `supabase/functions/generate-mission/index.ts` | 프롬프트 조립 + AI 호출 |
| 패턴 라이브러리 | `supabase/functions/generate-mission/mission-patterns.json` | 카테고리별 패턴 정의 |
| 미션 화면 | `src/pages/Home/Today.tsx` | 생성된 미션 표시/관리 |

---

## 2. 클라이언트 호출

### 파일: `src/lib/openai.ts`

클라이언트는 3가지 함수로 Edge Function을 호출합니다:

### 2-1. `generateMissions()` — Daily Missions (3개 배치)

```typescript
export async function generateMissions(
    userProfile: any,       // { id, age, gender, height, weight, job, condition_today }
    language: string,       // 'ko' | 'en'
    _excludedMissions: [],  // 미사용 (서버에서 fingerprint로 관리)
    targetGoal: any,        // 현재 선택된 목표 { category, target_text, details }
    refresh: boolean        // 새로고침 여부
): Promise<MissionData[]>
```

**호출 payload:**
```json
{
    "type": "daily_missions",
    "payload": {
        "userProfile": {
            "id": "uuid",
            "age": 35,
            "gender": "male",
            "height": 175,
            "weight": 72,
            "job": "개발자/사무직",
            "condition_today": 4
        },
        "language": "ko",
        "goalList": { "body_wellness": "매일 술 한잔씩 하기 대결" },
        "refresh": false
    }
}
```

**goalList 및 카테고리 매핑 규칙:**
- **일반 목표**: `targetGoal`이 전달되면 `{ [category]: target_text }` 형태로 전송 (FunPlay 포함 전 카테고리 3개 미션 생성).
- **1:1 버디 챌린지 (`category === 'buddy_challenge'`)**: `targetCategory`를 `details.original_category || 'body_wellness'`로 매핑하고, `target_text`에 대결 챌린지명을 전달하여 해당 1:1 대결 주제에 특화된 3개 미션 생성.
- `targetGoal`이 `null`이면 → `{}` (Edge Function이 DB `user_goals`에서 최신 목표 조회).

**실패 시 맞춤형 폴백:**
- 목표 키워드(예: 명상, 호흡, 걷기, 스트레칭 등)를 감지하여 주제에 정확히 부합하는 3개의 로컬 스마트 미션 생성.

### 2-2. `generateFunPlayMission()` — FunPlay (1개)

```typescript
export async function generateFunPlayMission(
    userProfile: any,
    language: string,
    _excludedKeywords: [],
    options: { difficulty: string, time_limit: number, mood: string, place: string },
    refresh: boolean
): Promise<MissionData>
```

**호출 body:**
```json
{
    "type": "funplay",
    "payload": {
        "userProfile": { "age": 25, "gender": "any" },
        "options": { "difficulty": "normal", "time_limit": 30, "mood": "fun", "place": "anywhere" },
        "language": "ko",
        "refresh": false
    }
}
```

### 2-3. `generateCoaching()` — 코칭 피드백

```typescript
export async function generateCoaching(
    user: any,
    goal: any,       // { category, target_text }
    stats: any,      // { successRate, streak }
    language: string
)
```

**호출 body:**
```json
{
    "type": "coaching",
    "payload": {
        "goal": { "category": "body_wellness", "target_text": "5kg 감량" },
        "stats": { "successRate": 80, "streak": 5 },
        "language": "ko"
    }
}
```

---

## 3. Edge Function 처리

### 파일: `supabase/functions/generate-mission/index.ts`

Edge Function은 요청을 받아 다음 순서로 처리합니다:

### Step 1: 인증

```typescript
const authHeader = req.headers.get('Authorization')!;
const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
);
```
- Supabase 게이트웨이 JWT 검증은 `--no-verify-jwt`로 비활성화
- Edge Function 내부에서 직접 `getUser()`로 인증 처리

### Step 2: Refresh 횟수 제한

```typescript
// 하루 3회 갱신 제한
const { data: refreshLog } = await supabase
    .from('mission_refresh_log')
    .select('refresh_count')
    .eq('user_id', userId)
    .eq('mission_date', today)
    .eq('category', type)
    .maybeSingle();

if (refreshLog && refreshLog.refresh_count >= 3) {
    return Response(JSON.stringify({ error: 'Refresh limit reached' }), { status: 429 });
}
```

### Step 3: 히스토리 조회 (Fingerprint)

```typescript
const { data: fingerprints } = await supabase
    .from('mission_fingerprint')
    .select('*')
    .eq('user_id', userId)
    .gte('mission_date', /* 7일 전 */);

const recentMissionsJson = JSON.stringify(fingerprints || []);
```

`mission_fingerprint` 테이블 구조:
| 컬럼 | 설명 |
|------|------|
| `user_id` | 사용자 UUID |
| `mission_date` | 미션 날짜 |
| `category` | 카테고리 |
| `pattern_id` | 사용된 패턴 ID |
| `primary_action` | 주 동작 동사 |
| `tool` | 사용 도구 |
| `place` | 장소 |
| `social_context` | 사회적 맥락 |
| `mechanic` | (FunPlay용) 메카닉 |

### Step 4: 사용자 목표 조회

```typescript
const { data: userGoals } = await supabase
    .from('user_goals')
    .select('category, target_text, details')
    .eq('user_id', userId)
    .eq('is_completed', false);

// category → target_text 맵 생성
const goalMap = {};
userGoals?.forEach(g => { goalMap[g.category] = g.target_text; });
```

### Step 5: 목표 우선순위 결정

```
클라이언트 goalList (선택된 콤보) > DB goalMap > 기본값
```

```typescript
const bwGoal = payload.goalList?.body_wellness || goalMap['body_wellness'] || '건강관리';
const gcGoal = payload.goalList?.growth_career || goalMap['growth_career'] || '자기계발';
const mcGoal = payload.goalList?.mind_connection || goalMap['mind_connection'] || '심리적안정';
```

### Step 6: 패턴 랜덤 선택

```typescript
const bwPattern = pickRandom(patterns.body_wellness);  // BW01~BW40 중 1개
const mcPattern = pickRandom(patterns.mind_connection); // MC01~MC50 중 1개

// Growth Career: 어학 감지 분기
if (isLanguageGoal(gcGoal)) {
    gcPattern = pickRandom(patterns.growth_career_language);  // GC_EN01~GC_EN30
    gcPatternSource = 'growth_career_language';
} else {
    gcPattern = pickRandom(patterns.growth_career);           // GC01~GC30
}
```

### Step 7: 프롬프트 조립 → OpenAI 호출

(상세 프롬프트는 [Section 5](#5-daily-missions-프롬프트) 참조)

```typescript
body = {
    model: "gpt-4o-mini",
    temperature: 0.8,    // Daily: 0.8 | FunPlay: 0.9 | Coaching: 0.6
    response_format: { type: "json_object" },
    messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ]
};

const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openAiKey}` },
    body: JSON.stringify(body)
});
```

---

## 4. 패턴 라이브러리

### 파일: `supabase/functions/generate-mission/mission-patterns.json`

패턴 라이브러리는 AI에게 **방법론적 힌트**를 제공하여 미션의 다양성을 보장합니다.

### 패턴 구조

```json
{
    "pattern_id": "BW16",
    "brief": "오늘 섭취한 음식 1개 칼로리 추정해보기",
    "core_type": "diet_awareness",
    "default_artifact_type": "text",
    "primary_action": "estimate",
    "tool": "phone",
    "place": "anywhere"
}
```

| 필드 | 설명 |
|------|------|
| `pattern_id` | 고유 식별자 (BW01, GC_EN05, MC10 등) |
| `brief` | AI에게 전달되는 방법론 힌트 (한국어) |
| `core_type` | 패턴의 핵심 유형 |
| `primary_action` | 주 동작 동사 (fingerprint용) |
| `tool` | 필요 도구 (none, phone, paper) |
| `place` | 적합 장소 (anywhere, home, outdoor, office) |
| `language_skill` | (어학 전용) 언어 학습 여부 |

### 카테고리별 패턴 수

| 카테고리 | 패턴 ID 범위 | 패턴 수 | 설명 |
|----------|-------------|---------|------|
| `body_wellness` | BW01 ~ BW40 | **40개** | 감각, 자세, 운동, 식단 등 |
| `growth_career` | GC01 ~ GC30 | **30개** | 의사결정, 학습, 자기계발 등 |
| `growth_career_language` | GC_EN01 ~ GC_EN30 | **30개** | 영어/외국어 회화 연습 |
| `mind_connection` | MC01 ~ MC50 | **50개** | 감정, 관계, 소통 스킬 |
| `funplay` | Archetypes 5 + Mechanics 12 + Twists 10 | **27개 요소** | 게임/도전 미션 |

### FunPlay 패턴 구조 (특수)

FunPlay는 배열이 아닌 객체 구조로 3개 요소를 조합합니다:

```json
{
    "funplay": {
        "archetypes": [
            { "id": "stealth_spy",        "name": "Stealth / Spy",         "description": "..." },
            { "id": "physical_challenge", "name": "Physical / Challenge",  "description": "..." },
            { "id": "absurdity_surreal",  "name": "Absurdity / Surreal",   "description": "..." },
            { "id": "observation_hunter", "name": "Observation / Hunter",  "description": "..." },
            { "id": "speed_reflex",       "name": "Speed / Reflex",        "description": "..." }
        ],
        "mechanics": [
            "countdown", "non_dominant", "silent_mode", "reverse_order",
            "tiny_target", "disguise_acting", "one_breath", "freeze_frame",
            "mirror_mode", "stealth_rule", "constraint_object", "speed_combo"
        ],
        "twist_modifiers": [
            "Use non-dominant hand", "Hold breath while doing it",
            "Do it in slow motion", "While making a specific face", ...
        ],
        "forbidden": [
            "standard exercises (squats, push-ups, etc.)",
            "generic advice (smile at someone)",
            "look at the sky/tree without a twist"
        ]
    }
}
```

**FunPlay 조합 공식:** `Archetype (5) × Mechanic (12) × Twist (10) = 600가지 조합`

---

## 5. Daily Missions 프롬프트

### 5-1. System Prompt

```
You are MyReDesign Mission Composer.

CRITICAL RULE:
User goal is NOT context. It is a NON-NEGOTIABLE CONSTRAINT.

Every mission MUST:
1) Directly reflect the user-defined goal.
2) Produce a tangible micro-output or action aligned with that goal.
3) Clearly show how the mission advances the goal.

If the mission could exist without referencing the goal,
it is INVALID and must be rewritten internally before output.

Do not produce generic productivity advice.
Do not produce category-only missions ignoring the goal.

Output strictly valid JSON only.
```

### 5-2. User Prompt

```
User Profile:
- age: {age}
- gender: {gender}
- height: {height}cm
- weight: {weight}kg
- job: {job}
- condition_today: {condition_today (1~5)}
- language: {ko|en}

═══ USER GOALS (TOPIC — these determine WHAT each mission is about) ═══
- body_wellness_goal: "{bwGoal}"
- growth_career_goal: "{gcGoal}"
- mind_connection_goal: "{mcGoal}"
- buddy_challenge_goal: "{buddyGoal (if applicable)}"

Context Knobs:
- time_budget_sec: 120
- constraint_seed: "{random_hex}"

History (Last 7 Days — avoid repeating):
{recentMissionsJson}

═══ PATTERN LIBRARY (METHOD HINT — three options per category) ═══
- body_wellness:
  1) {bwPattern1}
  2) {bwPattern2}
  3) {bwPattern3}
- growth_career:
  1) {gcPattern1}
  2) {gcPattern2}
  3) {gcPattern3}
- mind_connection:
  1) {mcPattern1}
  2) {mcPattern2}
  3) {mcPattern3}

⚠️ GOAL vs PATTERN PRIORITY:
- The GOAL determines the SUBJECT/TOPIC.
- The PATTERN is just a METHOD HINT. Use a DIFFERENT pattern for each of the 3 missions in a category.

Hard Rules:
1) Create exactly 3 missions per category (9 total).
2) Each mission in a category MUST use a DIFFERENT pattern from the list provided above.
3) Doable within 120 seconds.
4) Strict anti-repeat: No reuse of primary action verbs from history.
5) Forbidden: No "drink water/sleep", No "read book/lecture", No "preaching/meditation".

User Rules:
1) Language: Korean (Natural, encouraging tone).
2) Structure: Action-oriented. specific.
3) Constraints: 
   - No "meditate" or generic advice.
   - For 'mind_connection', establish specific scenarios.
   - BAD: "오늘 대화 톤 설정하기" (Too vague)
   - GOOD: "오늘 대화에서 사용할 ‘따뜻한’ 혹은 ‘단호한’ 톤 하나를 미리 정해보세요."
   - BAD: "경청하기"
   - GOOD: "대화 중 끼어들고 싶을 때 사용할 양해 문장('잠시만요, 다 듣고 말씀드릴게요')을 준비하세요."
   - BAD: "감사하기"
   - GOOD: "단순 감사 대신, 상대방의 구체적인 행동을 언급하며 인정하는 문장을 만들어보세요."

Category Style Rules:
- body_wellness: MUST relate to "{bwGoal}".
- growth_career: MUST relate to "{gcGoal}".
- mind_connection: MUST relate to "{mcGoal}".

Output Schema:
{
  "date": "YYYY-MM-DD",
  "missions": [
    // 9 missions total (3 per category)
    {
      "category": "body_wellness|growth_career|mind_connection",
      "pattern_id": "string",
      "title": "Short title",
      "content": "Direct action instruction (1-2 sentences). Do NOT include reasoning here.",
      "verification_type": "checkbox|text|photo",
      "success_criteria": ["step1"],
      "novelty_tags": ["action:verb", "place:loc", "tool:item"],
      "fingerprint": {
          "primary_action": "verb",
          "tool": "item",
          "place": "loc",
          "social_context": "type"
      },
      "trust_score": 85 // integer 80-99
    }
  ]
}

### 5-3. AI 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `model` | `gpt-4o-mini` | 비용 효율적인 모델 |
| `temperature` | `0.7` | 창의성과 안정성 균형 (0.6 -> 0.7) |
| `top_p` | `0.9` | 다양성 확보 |
| `frequency_penalty` | `0.2` | 반복 억제 (완화) |
| `presence_penalty` | `0.3` | 주제 전환 유도 (완화) |
| `response_format` | `{ type: "json_object" }` | JSON 강제 |

---

## 6. FunPlay 미션 프롬프트

### 6-1. System Prompt

```
Role: Ultimate Game Master Engine. Priority: UNEXPECTEDNESS, NOVELTY.
Forbidden: standard exercises (squats, push-ups, etc.); generic advice (smile at someone); look at the sky/tree without a twist.
If the last mission used the same archetype, STRICTLY pick a different one.
```

### 6-2. User Prompt

```
User: {age}y {gender}.
Req: Diff {difficulty}, Time {time_limit}s, Place {place}, Mood {mood}.
History: {recentMissionsJson}

Selected Setup:
- Archetype: "{archetype.name}" — {archetype.description}
- Mechanic: "{mechanic}"
- Twist Modifier: "{twist}"

Task: Generate 1 FunPlay mission using the above archetype + mechanic + twist.
Ensure it is COMPLETELY different from History.
Language: {ko|en}.

Output JSON:
{
  "category": "funplay",
  "archetype": "{archetype.id}",
  "content": "Mission instruction with twist included (1-2 sentences)",
  "verification_type": "checkbox",
  "fingerprint": { "primary_action": "verb", "mechanic": "{mechanic}", "place": "loc" },
  "reasoning": { "expected_impact": "Why this is fun (1 sentence)" }
}
```

### 6-3. AI 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `model` | `gpt-4o-mini` | 동일 |
| `temperature` | `0.9` | 더 높은 창의성 |

---

## 7. Coaching 프롬프트

### 7-1. System Prompt

```
Expert performance coach. Concise JSON output.
```

### 7-2. User Prompt

```
Goal: "{target_text}" ({category}).
Success: {successRate}%, Streak: {streak}d.
Task: Provide 1 short "insight" (tactical, max 15 words) and 1 short "encouragement" (max 10 words).
Language: {ko|en}.
JSON: { "insight", "encouragement" }
```

### 7-3. AI 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `model` | `gpt-4o-mini` | 동일 |
| `temperature` | `0.6` | 안정적 응답 |

---

## 8. 응답 처리 & 저장

### 8-1. OpenAI 응답 파싱

```typescript
const aiData = await response.json();
const content = JSON.parse(aiData.choices[0].message.content);
```

### 8-2. Fingerprint 저장

각 미션의 `fingerprint` 객체를 `mission_fingerprint` 테이블에 저장하여 7일간 반복 방지에 사용합니다:

```typescript
const missions = content.missions || [content]; // daily는 배열, funplay는 단일 객체

for (const m of missions) {
    if (m.fingerprint) {
        await supabase.from('mission_fingerprint').upsert({
            user_id: userId,
            mission_date: today,
            category: m.category,
            pattern_id: m.pattern_id,
            primary_action: m.fingerprint.primary_action,
            tool: m.fingerprint.tool,
            place: m.fingerprint.place,
            social_context: m.fingerprint.social_context,
            mechanic: m.fingerprint.mechanic   // FunPlay 전용
        }, { onConflict: 'user_id,mission_date,category' });
    }
}
```

### 8-3. Refresh 횟수 업데이트

```typescript
if (payload.refresh) {
    // RPC 호출 시도 → 실패 시 fallback upsert
    await supabase.rpc('increment_refresh_count', {
        p_user_id: userId,
        p_date: today,
        p_category: type
    });
}
```

### 8-4. 관련 DB 테이블

| 테이블 | 역할 |
|--------|------|
| `user_goals` | 사용자 설정 목표 (category별) |
| `missions` | 완료된 미션 기록 |
| `mission_fingerprint` | 미션 중복 방지용 지문 (7일 보존) |
| `mission_refresh_log` | 일일 갱신 횟수 추적 (최대 3회) |

---

## 9. 어학 목표 자동 감지

### 감지 함수

```typescript
function isLanguageGoal(goalText: string): boolean {
    const keywords = [
        '영어', '어학', 'english', 'conversation', '외국어',
        '일본어', '중국어', 'japanese', 'chinese', 'french',
        '프랑스어', 'language', '회화', '말하기', 'speaking', '언어'
    ];
    return keywords.some(k => goalText.toLowerCase().includes(k));
}
```

### 동작 흐름

```
사용자 목표: "영어 회화 일상적인 대화수준까지 습득하기"
                    ↓
         isLanguageGoal() = true ✅
                    ↓
         패턴 풀: growth_career_language (GC_EN01~GC_EN30) 사용
                    ↓
         프롬프트에 [LANGUAGE LEARNING MODE] 플래그 추가
                    ↓
         Hard Rules에 추가:
         "growth_career mission MUST be a language learning exercise
          in the user's target language. Include target-language
          sentences in the content."
```

### 예시 (GC_EN05 선택 시)

**프롬프트 주입:**
```
- growth_career → method_hint: "일상 상황(마트/지하철/병원) 랜덤 1개로 대화 3줄"
  (type: situation_card) [LANGUAGE LEARNING MODE]
```

**AI 생성 결과 예시:**
```json
{
    "category": "growth_career",
    "pattern_id": "GC_EN05",
    "title": "🏥 병원 접수 대화",
    "content": "병원 접수 상황을 영어 3줄 대화로 연습하세요.\n  A: Hi, I'd like to make an appointment.\n  B: Sure, what seems to be the problem?\n  A: I've been having headaches for a few days.",
    "verification_type": "text"
}
```

---

## 10. 디버깅 & 배포 가이드

### 10-1. 디버그 로그

Edge Function에 디버그 로그가 내장되어 있습니다:

```typescript
// 목표 해석 추적
console.log('[DEBUG] Goal Resolution:', {
    'payload.goalList': payload.goalList,
    'goalMap (from DB)': goalMap,
    'resolved': { bwGoal, gcGoal, mcGoal },
    'isLanguageGoal(gcGoal)': isLanguageGoal(gcGoal)
});

// 패턴 선택 추적
console.log('[DEBUG] Pattern Selection:', {
    bw: bwPattern.pattern_id,
    gc: `${gcPattern.pattern_id} (source: ${gcPatternSource})`,
    mc: mcPattern.pattern_id
});
```

**로그 확인 방법:**
```bash
supabase functions logs generate-mission --follow
```

### 10-2. 배포

```bash
# Edge Function 배포
supabase functions deploy generate-mission --no-verify-jwt

# ⚠️ 주의: mission-patterns.json이 같은 폴더에 있어야 합니다
# Deno의 JSON import assertion 사용:
# import patterns from "./mission-patterns.json" assert { type: "json" };
```

### 10-3. 환경 변수

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 역할 키 (관리자 권한) |
| `OPENAI_API_KEY` | OpenAI API 키 |

### 10-4. 에러 처리

```
클라이언트 (openai.ts)
├── Edge Function 호출 실패 → MOCK_MISSIONS 반환
├── error 응답 → throw → catch → MOCK_MISSIONS
└── missions 비어있음 → MOCK_MISSIONS

Edge Function (index.ts)
├── 인증 실패 → 401 Unauthorized
├── Refresh 초과 → 429 Refresh limit reached
├── OpenAI 에러 → 500 + 에러 메시지
└── JSON 파싱 실패 → 500 + 에러 메시지
```

---

## 📊 전체 흐름 요약

```
[사용자가 Today 탭 진입]
         │
         ▼
[generateMissions() 호출]
  - userProfile, language, goalList 준비
         │
         ▼
[Edge Function 수신]
  - JWT 인증 ✓
  - Refresh 제한 확인 (≤3/day) ✓
         │
         ▼
[데이터 수집]
  - mission_fingerprint (7일) → 히스토리 JSON
  - user_goals (is_completed=false) → 목표 맵
         │
         ▼
[목표 결정]
  Client goalList > DB goalMap > 기본값
  - body_wellness: "{bwGoal}"
  - growth_career: "{gcGoal}" → isLanguageGoal() 판별
  - mind_connection: "{mcGoal}"
         │
         ▼
[패턴 선택]
  - BW: BW01~BW40 중 랜덤 1개
  - GC: 어학이면 GC_EN01~30, 아니면 GC01~30
  - MC: MC01~MC50 중 랜덤 1개
         │
         ▼
[프롬프트 조립]
  System: "미션 작곡가, 목표=절대적 제약"
  User: 목표(TOPIC) + 패턴(METHOD) + 히스토리 + 규칙
         │
         ▼
[OpenAI API 호출]
  Model: gpt-4o-mini / Temp: 0.8 / JSON Mode
         │
         ▼
[응답 처리]
  - JSON 파싱
  - Fingerprint 저장 (upsert)
  - Refresh 카운트 증가
         │
         ▼
[클라이언트 반환]
  { "date": "2026-02-16", "missions": [...] }
         │
         ▼
[Today.tsx에서 카드로 표시]
```