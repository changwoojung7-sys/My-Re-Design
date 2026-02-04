import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

        const { type, payload } = await req.json();

        let endpoint = 'https://api.openai.com/v1/chat/completions';
        let body: any = {
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [],
            response_format: { type: "json_object" }
        };

        // --- Logic: Daily Missions ---
        if (type === 'daily_missions') {
            const { userProfile, language, goalList, recentMissions } = payload;

            const prompt = `
            Context: ${userProfile?.age || 25}y ${userProfile?.gender || 'adult'}. Goals: ${goalList}
            History (3 Days): ${recentMissions || "None"}
            Task: Create 3 quick missions (<3 mins) per category. Focus on achievement and fun.
            Language: ${language === 'ko' ? 'Korean' : 'English'}

            Rules:
            1. body_wellness: Focus on [Active Goal]. 2 action missions, 1 awareness mission. NO "Drink Water/Sleep".
            2. growth_career: Micro-growth experiments. Focus on perspective shift. NO "Read book/Lecture".
            3. mind_connection: Emotion/Relationship focus. NO preaching or heavy meditation.
            
            Format: { "missions": [{ "category", "content", "verification_type", "reasoning": { "expected_impact": "1 short sentence" }, "trust_score" }] }
            `;

            body.messages = [
                { role: "system", content: "Personalized habit coach. Output strictly valid JSON." },
                { role: "user", content: prompt }
            ];
        }

        // --- Logic: FunPlay ---
        else if (type === 'funplay') {
            const { options, language, excludedKeywords, userProfile, recentMissions } = payload;

            const systemPrompt = `
            Role: FunPlay Engine. Priority: FUN, WHIMSY. 
            BAN: Self-improvement, Productivity, "Useful" advice. 
            Rule: If it feels like work, reject. If it feels like a game, accept.
            History (3 Days): ${recentMissions || "None"}
            `;

            const userPrompt = `
            User: ${userProfile?.age || 25}y ${userProfile?.gender || 'adult'}. 
            Req: Diff ${options.difficulty}, Time ${options.time_limit}s, Place ${options.place}, Mood ${options.mood}.
            Excludes: ${excludedKeywords?.join(', ')}. Language: ${language === 'ko' ? 'Korean' : 'English'}.
            Output JSON: { "category": "funplay", "content": "1-2 short sentences", "verification_type": "checkbox", "reasoning": { "expected_impact": "1 short sentence" } }
            `;

            body.messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];
            body.temperature = 0.9;
        }

        // --- Logic: Coaching ---
        else if (type === 'coaching') {
            const { goal, stats, language } = payload;

            const prompt = `
            Goal: "${goal.target_text}" (${goal.category}). Success: ${stats.successRate}%, Streak: ${stats.streak}d.
            Task: Provide 1 short "insight" (tactical, max 15 words) and 1 short "encouragement" (max 10 words).
            Language: ${language === 'ko' ? "Korean" : "English"}. JSON: { "insight", "encouragement" }
            `;

            body.messages = [
                { role: "system", content: "Expert performance coach. Concise JSON output." },
                { role: "user", content: prompt }
            ];
            body.max_tokens = 100;
        }

        else {
            throw new Error(`Unknown type: ${type}`);
        }

        // Execute OpenAI Request
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI Error: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content || "{}");

        return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
