import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
            const { userProfile, language, excludedMissions, goalList } = payload;

            const prompt = `
            Context: User is ${userProfile.age || 25} years old ${userProfile.gender || 'adult'}. ${userProfile.height ? `Height: ${userProfile.height}cm,` : ''} ${userProfile.weight ? `Weight: ${userProfile.weight}kg.` : ''}
            Language: ${language === 'ko' ? 'Korean' : 'English'}
            
            Active Goals:
            ${goalList}
        
            Task:
            For EACH active goal category listed above, create exactly 3 simple daily missions.
            - The PRIMARY GOAL is to let the user feel a "sense of achievement" and "fun".
            - MUST be doable in < 3 mins (Very quick & easy).
            - Output the content in ${language === 'ko' ? 'Korean' : 'English'}.
        
            EXCLUSION RULES (IMPORTANT):
            - Do NOT generate missions that are identical or very similar to the following recent missions:
            ${excludedMissions?.length > 0 ? excludedMissions.map((m: any) => `- ${m}`).join('\n') : "(No exclusions)"}
            
            Category Guidelines: (Brief)
            1. body_wellness: Mix Physical + Vitality/Hobby. < 3 mins.
            2. growth_career: Micro-actions (Read 1 page, Check 1 email).
            3. mind_connection: Inner Peace + Social.
        
            Output Format (JSON Object):
            {
              "missions": [
                { 
                    "category": "body_wellness", 
                    "content": "Drink 1 cup of water", 
                    "verification_type": "image",
                    "reasoning": { "user_context": "...", "scientific_basis": "...", "expected_impact": "..." },
                    "trust_score": 95
                }, ...
              ]
            }
            `;

            body.messages = [
                {
                    role: "system",
                    content: `You are a personalized habit coach. Output strictly valid JSON.
                    The output should be a JSON object with a key "missions" containing an array of mission objects.
                    Valid values for "verification_type" are "text", "image", "camera", "checkbox".
                    Ensure the content is written in ${language === 'ko' ? 'Korean' : 'English'}.`
                },
                { role: "user", content: prompt }
            ];
        }

        // --- Logic: FunPlay ---
        else if (type === 'funplay') {
            const { options, language, excludedKeywords } = payload;

            const systemPrompt = `
            You are "FunPlay – 30 Second Real Mission" engine.
            Goal: Create a light, fun, realistic mission doable in 30-60s.
            Principles: Simple, Safe, Free (0 cost), Accessible, No Embarrassment.
            Language: ${language === 'ko' ? 'Korean' : 'English'}.

            CRITICAL INSTRUCTION - AVOID BOREDOM:
            - **STOP generating "Just smile" or "Just breathe" missions.** They are too passive.
            - **Prefer ACTIVE & FUN actions.**

            RANDOM CATEGORY SELECTION (Pick one internally):
            1. **Active Body (40%)**: Superhero pose, Invisible jump rope, Slow motion punch, Stretch like a cat.
            2. **Mime / Acting (30%)**: Eat a sour lemon face, Zombie walk, Air guitar, Pretend to lift something heavy.
            3. **Quick Challenge (10%)**: Stand on one leg eyes closed (10s), Tongue twister, Rock Paper Scissors vs Yourself.
            4. **Object/Finding (20%)**: Find red object, touch a wall, grab a pen. (Keep this manageable).

            ANTI-REPETITION:
            - Do NOT overuse "Find".
            - Do NOT overuse "Smile".
            - Make it playful! "Smile like a villain" is better than "Smile".

            Output JSON Only:
            {
                "category": "funplay",
                "content": "Mission Content",
                "verification_type": "checkbox",
                "reasoning": { "expected_impact": "..." },
                "trust_score": 90
            }
            `;

            const userPrompt = `
            [Request]
            Difficulty: ${options.difficulty}
            Time: ${options.time_limit}
            Place: ${options.place}
            Mood: ${options.mood}
            Excluded Keywords: ${excludedKeywords?.join(', ')}
            
            Requirements:
            - 1 mission only
            - 30-60s completion
            - Title + 1-2 sentence description + Success condition + Optional fail comment
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
            Analyze user progress: "${goal.target_text}" (Category: ${goal.category}).
            Stats: Total ${stats.total}, Success ${stats.successRate}%, Streak ${stats.streak} days.
            Recent: ${JSON.stringify(stats.recentHistory)}

            As Expert Coach, provide:
            1. "insight": Tactical advice (max 2 sentences).
            2. "encouragement": Motivating phrase (max 1 sentence).

            Output JSON: { "insight": "...", "encouragement": "..." }
            Language: ${language === 'ko' ? "Korean" : "English"}.
            `;

            body.messages = [
                { role: "system", content: "You are a warm but sharp performance coach. Output strictly valid JSON." },
                { role: "user", content: prompt }
            ];
            body.max_tokens = 150;
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
