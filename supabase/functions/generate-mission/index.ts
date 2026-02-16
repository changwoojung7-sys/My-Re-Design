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
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.2,
            presence_penalty: 0.3,
            response_format: { type: "json_object" }
        };

        // ==============================
        // --- Daily Missions (Batch) ---
        // ==============================
        if (type === 'daily_missions') {
            const { userProfile } = payload;

            // Determine requested categories
            const requested = payload.goalList && Object.keys(payload.goalList).length > 0
                ? Object.keys(payload.goalList)
                : ['body_wellness', 'growth_career', 'mind_connection'];

            // Assign goals only if requested
            const bwGoal = requested.includes('body_wellness') ? (payload.goalList?.body_wellness || goalMap['body_wellness'] || '건강관리') : null;
            const gcGoal = requested.includes('growth_career') ? (payload.goalList?.growth_career || goalMap['growth_career'] || '자기계발') : null;
            const mcGoal = requested.includes('mind_connection') ? (payload.goalList?.mind_connection || goalMap['mind_connection'] || '심리적안정') : null;

            // 🔍 DEBUG: Log goal resolution
            console.log('[DEBUG] Goal Resolution:', {
                'requested': requested,
                'resolved': { bwGoal, gcGoal, mcGoal }
            });

            // Helper to pick N random items
            const pickRandomN = (arr: any[], n: number) => {
                const shuffled = [...arr].sort(() => 0.5 - Math.random());
                return shuffled.slice(0, n);
            };

            // Pick patterns only for active goals
            const bwPatterns = bwGoal ? pickRandomN(patterns.body_wellness as Pattern[], 3) : [];
            const mcPatterns = mcGoal ? pickRandomN(patterns.mind_connection as Pattern[], 3) : [];

            let gcPatterns: Pattern[] = [];
            let gcPatternSource = 'growth_career';
            if (gcGoal) {
                if (isLanguageGoal(gcGoal)) {
                    gcPatterns = pickRandomN(patterns.growth_career_language as Pattern[], 3);
                    gcPatternSource = 'growth_career_language';
                } else {
                    gcPatterns = pickRandomN(patterns.growth_career as Pattern[], 3);
                }
            }

            // Construct User Goals Section
            let goalsSection = '═══ USER GOALS (TOPIC — create missions ONLY for these) ═══\n';
            if (bwGoal) goalsSection += `- body_wellness_goal: "${bwGoal}"\n`;
            if (gcGoal) goalsSection += `- growth_career_goal: "${gcGoal}"\n`;
            if (mcGoal) goalsSection += `- mind_connection_goal: "${mcGoal}"\n`;

            // Construct Pattern Library Section
            let patternsSection = '═══ PATTERN LIBRARY (METHOD HINT) ═══\n';
            if (bwGoal) {
                patternsSection += `- body_wellness:\n`;
                patternsSection += `  1) ${bwPatterns[0].brief} (type: ${bwPatterns[0].core_type})\n`;
                patternsSection += `  2) ${bwPatterns[1].brief} (type: ${bwPatterns[1].core_type})\n`;
                patternsSection += `  3) ${bwPatterns[2].brief} (type: ${bwPatterns[2].core_type})\n`;
            }
            if (gcGoal) {
                patternsSection += `- growth_career (source: ${gcPatternSource}):\n`;
                patternsSection += `  1) ${gcPatterns[0].brief} (type: ${gcPatterns[0].core_type})\n`;
                patternsSection += `  2) ${gcPatterns[1].brief} (type: ${gcPatterns[1].core_type})\n`;
                patternsSection += `  3) ${gcPatterns[2].brief} (type: ${gcPatterns[2].core_type})\n`;
            }
            if (mcGoal) {
                patternsSection += `- mind_connection:\n`;
                patternsSection += `  1) ${mcPatterns[0].brief} (type: ${mcPatterns[0].core_type})\n`;
                patternsSection += `  2) ${mcPatterns[1].brief} (type: ${mcPatterns[1].core_type})\n`;
                patternsSection += `  3) ${mcPatterns[2].brief} (type: ${mcPatterns[2].core_type})\n`;
            }

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
Generate missions ONLY for the categories listed in USER GOALS.

Output strictly valid JSON only.`;

            const userPrompt = `
User Profile:
- age: ${userProfile?.age || 25}
- gender: ${userProfile?.gender || 'any'}
- language: ${payload.language || 'ko'}

${goalsSection}

Context Knobs:
- time_budget_sec: 120
- constraint_seed: "${Math.random().toString(36).substring(7)}"

History (Last 7 Days — avoid repeating):
${recentMissionsJson}

${patternsSection}
`;

            const warning = `
⚠️ GOAL vs PATTERN PRIORITY:
- The GOAL determines the SUBJECT / TOPIC.
- The PATTERN is just a METHOD HINT. Use a DIFFERENT pattern for each of the 3 missions in a category.

Hard Rules:
1) Create exactly 3 missions per REQUESTED category.
2) Each mission in a category MUST use a DIFFERENT pattern from the list provided above.
3) Doable within 120 seconds.
4) Strict anti-repeat: No reuse of primary action verbs from history.
5) Forbidden: No "drink water/sleep", No "read book/lecture", No "preaching/meditation".
${gcPatternSource === 'growth_career_language' ? '6) growth_career missions MUST be language learning exercises in the user\'s target language.' : ''}

Category Style Rules:
${bwGoal ? `- body_wellness: MUST relate to "${bwGoal}".` : ''}
${gcGoal ? `- growth_career: MUST relate to "${gcGoal}".` : ''}
${mcGoal ? `- mind_connection: MUST relate to "${mcGoal}".` : ''}

User Rules:
1) Language: Korean (Natural, encouraging tone).
2) Structure: Action-oriented, specific.
3) Constraints: No "meditate" or generic advice.
`;

            const outputSchema = `
Output Schema:
{
    "date": "${today}",
    "missions": [
        // 3 missions per REQUESTED category
        {
            "category": "body_wellness|growth_career|mind_connection",
            "pattern_id": "string",
            "title": "Short title",
            "content": "Direct action instruction (1-2 sentences). Do NOT include reasoning here.",
            "reasoning": "Brief explanation of why this mission helps the goal (1 sentence).",
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
`;

            const finalUserPrompt = userPrompt + warning + outputSchema;

            body.messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: finalUserPrompt }
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
Req: Diff ${options.difficulty}, Time ${options.time_limit} s, Place ${options.place}, Mood ${options.mood || 'fun'}.
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
            const userPrompt = `Goal: "${goal?.target_text}"(${goal?.category}). Success: ${stats?.successRate || 0}%, Streak: ${stats?.streak || 0} d.
    Task: Provide 1 short "insight" (tactical, max 15 words) and 1 short "encouragement" (max 10 words).
        Language: ${payload.language || 'ko'}. JSON: { "insight", "encouragement" } `;

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
