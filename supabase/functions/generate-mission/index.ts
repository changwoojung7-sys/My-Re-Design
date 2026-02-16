import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore: Deno JSON import
import patterns from "./mission-patterns.json" assert { type: "json" };

// --- Types ---
interface Pattern {
    pattern_id: string;
    brief: string;
    core_type: string;
    default_artifact_type: string;
    primary_action: string;
    tool: string;
    place: string;
    language_skill?: boolean;
}

interface Archetype {
    id: string;
    name: string;
    description: string;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Helper: Pick random item from array ---
function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- Helper: Detect language-learning goal ---
function isLanguageGoal(goalText: string): boolean {
    const keywords = ['영어', '어학', 'english', 'conversation', '외국어', '일본어', '중국어', 'japanese', 'chinese', 'french', '프랑스어', 'language', '회화', '말하기', 'speaking', '언어'];
    return keywords.some(k => goalText.toLowerCase().includes(k));
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('[DEBUG] Function invoked, method:', req.method);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const openAiKey = Deno.env.get('OPENAI_API_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get user from JWT
        const authHeader = req.headers.get('Authorization')!;
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const { type, payload } = await req.json();
        const userId = user.id;
        console.log('[DEBUG] type:', type, 'userId:', userId);

        // --- 1. Check Refresh Limits ---
        const today = new Date().toISOString().split('T')[0];
        if (payload.refresh) {
            const { data: refreshLog } = await supabase
                .from('mission_refresh_log')
                .select('refresh_count')
                .eq('user_id', userId)
                .eq('mission_date', today)
                .eq('category', type)
                .maybeSingle();

            if (refreshLog && refreshLog.refresh_count >= 3) {
                return new Response(JSON.stringify({ error: 'Refresh limit reached' }), {
                    status: 429,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // --- 2. Fetch History (Fingerprints, last 7 days) ---
        const { data: fingerprints } = await supabase
            .from('mission_fingerprint')
            .select('*')
            .eq('user_id', userId)
            .gte('mission_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const recentMissionsJson = JSON.stringify(fingerprints || []);

        // --- 3. Fetch User Goals from DB ---
        const { data: userGoals } = await supabase
            .from('user_goals')
            .select('category, target_text, details')
            .eq('user_id', userId)
            .eq('is_completed', false);

        // Build goal map: category -> target_text
        const goalMap: Record<string, string> = {};
        if (userGoals) {
            for (const g of userGoals) {
                goalMap[g.category] = g.target_text || '';
            }
        }

        let body: any = {
            model: "gpt-4o-mini",
            temperature: 0.8,
            response_format: { type: "json_object" }
        };

        // ==============================
        // --- Daily Missions (Batch) ---
        // ==============================
        if (type === 'daily_missions') {
            const { userProfile } = payload;

            // PRIORITY: Client-sent goal (from selected combo) > DB fallback > default
            // The client sends the SPECIFIC goal the user is viewing, which must take priority
            const bwGoal = payload.goalList?.body_wellness || goalMap['body_wellness'] || '건강관리';
            const gcGoal = payload.goalList?.growth_career || goalMap['growth_career'] || '자기계발';
            const mcGoal = payload.goalList?.mind_connection || goalMap['mind_connection'] || '심리적안정';

            // 🔍 DEBUG: Log goal resolution
            console.log('[DEBUG] Goal Resolution:', {
                'payload.goalList': payload.goalList,
                'goalMap (from DB)': goalMap,
                'resolved': { bwGoal, gcGoal, mcGoal },
                'isLanguageGoal(gcGoal)': isLanguageGoal(gcGoal)
            });

            // Pick random patterns (typed)
            const bwPattern = pickRandom(patterns.body_wellness as Pattern[]);
            const mcPattern = pickRandom(patterns.mind_connection as Pattern[]);

            // For growth_career: detect language goal → use language patterns
            let gcPattern: Pattern;
            let gcPatternSource = 'growth_career';
            if (isLanguageGoal(gcGoal)) {
                gcPattern = pickRandom(patterns.growth_career_language as Pattern[]);
                gcPatternSource = 'growth_career_language';
            } else {
                gcPattern = pickRandom(patterns.growth_career as Pattern[]);
            }

            // 🔍 DEBUG: Log pattern selection
            console.log('[DEBUG] Pattern Selection:', {
                bw: bwPattern.pattern_id,
                gc: `${gcPattern.pattern_id} (source: ${gcPatternSource})`,
                mc: mcPattern.pattern_id
            });

            const systemPrompt = `You are MyReDesign Mission Composer.

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

Output strictly valid JSON only.`;

            const userPrompt = `
User Profile:
- age: ${userProfile?.age || 25}
- gender: ${userProfile?.gender || 'any'}
- language: ${payload.language || 'ko'}

═══ USER GOALS (TOPIC — these determine WHAT each mission is about) ═══
- body_wellness_goal: "${bwGoal}"
- growth_career_goal: "${gcGoal}"
- mind_connection_goal: "${mcGoal}"

Context Knobs:
- time_budget_sec: 120
- constraint_seed: "${Math.random().toString(36).substring(7)}"

History (Last 7 Days — avoid repeating):
${recentMissionsJson}

═══ PATTERN LIBRARY (METHOD HINT — these suggest HOW to approach, NOT what topic) ═══
- body_wellness → method_hint: "${bwPattern.brief}" (type: ${bwPattern.core_type})
- growth_career → method_hint: "${gcPattern.brief}" (type: ${gcPattern.core_type})${gcPatternSource === 'growth_career_language' ? ' [LANGUAGE LEARNING MODE]' : ''}
- mind_connection → method_hint: "${mcPattern.brief}" (type: ${mcPattern.core_type})

⚠️ GOAL vs PATTERN PRIORITY:
- The GOAL determines the SUBJECT/TOPIC of the mission (e.g., "식단 조절" → mission is about food/diet).
- The PATTERN is just a METHOD HINT for structure (e.g., "점수화" → apply scoring as a method TO the goal topic).
- If the pattern seems unrelated to the goal, IGNORE the pattern and directly serve the goal.
- Example: goal="식단 조절", pattern="비우세손으로 동작" → mission should be about diet (goal wins), NOT hand exercise.

Hard Rules:
1) Create exactly 1 mission per category (3 total).
2) Each mission's TOPIC must come from the user's GOAL, not the pattern brief.
3) The pattern brief is only a structural/creative METHOD suggestion — adapt or ignore if it conflicts with the goal.
4) Doable within 120 seconds.
5) Strict anti-repeat: No reuse of primary action verbs from history. No similar semantic intent.
6) Forbidden: No "drink water/sleep", No "read book/lecture", No "preaching/meditation".${gcPatternSource === 'growth_career_language' ? '\n7) growth_career mission MUST be a language learning exercise in the user\'s target language. Include target-language sentences in the content.' : ''}

Category Style Rules:
- body_wellness: 1 "micro-body tune" OR "sensory calibration" OR "posture & breath with twist" (not meditation). MUST relate to "${bwGoal}".
- growth_career: 1 "micro-experiment" producing a tiny artifact (1 line note, 1 decision rule, 1 mini plan). MUST relate to "${gcGoal}".
- mind_connection: 1 "emotion labeling + micro-connection" OR "boundary/relationship micro-script". MUST relate to "${mcGoal}".

Output Schema:
{
  "date": "${today}",
  "missions": [
    {
      "category": "body_wellness|growth_career|mind_connection",
      "pattern_id": "string",
      "title": "short",
      "content": "1-2 sentences, specific, goal-connected",
      "verification_type": "checkbox|text|photo",
      "success_criteria": ["step1"],
      "novelty_tags": ["action:verb", "place:loc", "tool:item"],
      "fingerprint": { "primary_action": "verb", "tool": "item", "place": "loc", "social_context": "type" },
      "reasoning": { "expected_impact": "1 sentence showing how this serves the user's goal" }
    }
  ]
}
            `;

            body.messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];
        }

        // ====================
        // --- FunPlay ---
        // ====================
        else if (type === 'funplay') {
            const { userProfile, options } = payload;

            // Pick random archetype & mechanic from library (typed)
            const archetype = pickRandom(patterns.funplay.archetypes as Archetype[]);
            const mechanic = pickRandom(patterns.funplay.mechanics as string[]);
            const twist = pickRandom(patterns.funplay.twist_modifiers as string[]);

            const systemPrompt = `Role: Ultimate Game Master Engine. Priority: UNEXPECTEDNESS, NOVELTY.
Forbidden: ${patterns.funplay.forbidden.join('; ')}.
If the last mission used the same archetype, STRICTLY pick a different one.`;

            const userPrompt = `
User: ${userProfile?.age || 25}y ${userProfile?.gender || 'any'}.
Req: Diff ${options.difficulty}, Time ${options.time_limit}s, Place ${options.place}, Mood ${options.mood || 'fun'}.
History: ${recentMissionsJson}

Selected Setup:
- Archetype: "${archetype.name}" — ${archetype.description}
- Mechanic: "${mechanic}"
- Twist Modifier: "${twist}"

Task: Generate 1 FunPlay mission using the above archetype + mechanic + twist.
Ensure it is COMPLETELY different from History.
Language: ${payload.language || 'ko'}.

Output JSON:
{
  "category": "funplay",
  "archetype": "${archetype.id}",
  "content": "Mission instruction with twist included (1-2 sentences)",
  "verification_type": "checkbox",
  "fingerprint": { "primary_action": "verb", "mechanic": "${mechanic}", "place": "loc" },
  "reasoning": { "expected_impact": "Why this is fun (1 sentence)" }
}
            `;

            body.messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];
            body.temperature = 0.9;
        }

        // ====================
        // --- Coaching ---
        // ====================
        else if (type === 'coaching') {
            const { goal, stats } = payload;
            const systemPrompt = `Expert performance coach. Concise JSON output.`;
            const userPrompt = `Goal: "${goal?.target_text}" (${goal?.category}). Success: ${stats?.successRate || 0}%, Streak: ${stats?.streak || 0}d.
Task: Provide 1 short "insight" (tactical, max 15 words) and 1 short "encouragement" (max 10 words).
Language: ${payload.language || 'ko'}. JSON: { "insight", "encouragement" }`;

            body.messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];
            body.temperature = 0.6;
        }

        // --- 5. Execute OpenAI ---
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const aiData = await response.json();

        if (!aiData.choices || !aiData.choices[0]) {
            throw new Error(`OpenAI error: ${JSON.stringify(aiData)}`);
        }

        const content = JSON.parse(aiData.choices[0].message.content);

        // --- 6. Persistence & Refresh Update ---
        if (payload.refresh) {
            await supabase.rpc('increment_refresh_count', {
                p_user_id: userId,
                p_date: today,
                p_category: type
            }).then(async ({ error }: { error: any }) => {
                // If RPC doesn't exist, fallback to upsert
                if (error) {
                    const { data: existing } = await supabase
                        .from('mission_refresh_log')
                        .select('refresh_count')
                        .eq('user_id', userId)
                        .eq('mission_date', today)
                        .eq('category', type)
                        .maybeSingle();

                    const newCount = (existing?.refresh_count || 0) + 1;
                    await supabase.from('mission_refresh_log').upsert({
                        user_id: userId,
                        mission_date: today,
                        category: type,
                        refresh_count: newCount
                    }, { onConflict: 'user_id,mission_date,category' });
                }
            });
        }

        // Save Fingerprints
        const missions = content.missions || [content];
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
                    mechanic: m.fingerprint.mechanic
                }, { onConflict: 'user_id,mission_date,category' });
            }
        }

        return new Response(JSON.stringify(content), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
