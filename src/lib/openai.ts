import OpenAI from 'openai';
import { supabase } from './supabase';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Mock missions for fallback
const MOCK_MISSIONS: MissionData[] = [
    { category: 'health', content: 'Do 10 squats.' },
    { category: 'growth', content: 'Read one page of a book.' },
    { category: 'mindset', content: 'Takes 3 deep breaths.' }
];

export interface MissionData {
    category: 'health' | 'growth' | 'mindset' | 'career' | 'social' | 'vitality';
    content: string;
    verification_type?: string;
}

export async function generateMissions(userProfile: any, language: string = 'en', excludedMissions: string[] = []): Promise<MissionData[]> {
    if (!apiKey || apiKey.includes('YOUR_OPENAI')) {
        console.warn("No OpenAI Key found, using Mock Data");
        return MOCK_MISSIONS;
    }

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

    // Fetch User Goals from DB
    const { data: userGoals } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', userProfile.id);

    // If no complex goals, fallback to simple profile check
    if (!userGoals || userGoals.length === 0) {
        console.log("No detailed goals found, using mocks");
        return MOCK_MISSIONS;
    }

    const goalList = userGoals.map((g: any) =>
        `- Category: ${g.category}\n  Goal: ${g.target_text}\n  Details: ${JSON.stringify(g.details)}`
    ).join('\n\n');

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
    ${excludedMissions.length > 0 ? excludedMissions.map(m => `- ${m}`).join('\n') : "(No exclusions)"}
    - Note: This exclusion applies strictly to categories: Vitality, Social, Mindset.
    - For Health, Growth, Career categories, you MAY repeat tasks if they are essential, but try to vary slightly.
    
    Category Specific Guidelines:
    
    [Special Rule for: vitality, social, mindset]
    - ALL 3 missions must be relevant to the category/goal.
    - Structure the 3 missions as follows:
      1. Fun/Enjoyable Mission (Lighthearted, pleasant, RELEVANT to the goal)
      2. Fun/Enjoyable Mission (Lighthearted, pleasant, RELEVANT to the goal)
      3. Core Task (Directly addresses the goal, strictly < 3 mins)
    
    1. health: 
       - STRICTLY analyze 'Goal Details', 'Current Status', and 'Final Goal'.
       - Use User's Height/Weight if provided to tailor intensity.
       - Cover diverse topics: Diet, Exercise, Recovery, Physical Health.
       - TIME LIMIT EXCEPTION: Generally < 3 mins. BUT if goal involves Running/Cardio/Endurance, allow up to 15 mins.
       - If user specified a target Distance (km) or Duration, RESPECT that value strictly (e.g. "Run 3km" if specified).
    2. growth: 
       - STRICTLY analyze 'Final Goal', 'Current Level', and 'Target Level'.
       - Tailor missions to bridge the gap between Current & Target level.
       - Focus on actionable micro-learning relevant to the specific goal (e.g. if goal is 'English', then 'memorize 1 word').
    3. mindset: 
       - Mix: 1 Fun (e.g. hum a song, smile in mirror) + 2 Core (e.g. praise yourself, write 1 brave sentence).
       - Concept: Healing, Comfort, and building Inner Strength.
       - Core missions must offer comfort, encouragement, or courage.
    4. career: 
       - STRICTLY analyze 'Final Goal' and 'Key Results' (KPIs).
       - Create missions that contribute to the specific Career Goal.
       - Focus on micro-efficiency, planning, or skill check relevant to the goal (e.g. goal is 'sales', then 'list 1 prospect').
    5. social: 
       - Mix: 2 Fun (e.g. send a funny emoji, send a heart) + 1 Core (e.g. short heartwarming text, "I appreciate you").
       - Core mission should be short but Touching/Impactful.
       - Focus on light connection without pressure.
    6. vitality: 
       - Mix: 2 Fun (e.g. play favorite song, dance 1 min) + 1 Core (e.g. high-five yourself in mirror, 1 min hobby focus).
       - Focus on recharging energy & giving POSITIVE FORCE to oneself.
       - Encourage self-care and personal hobbies.

    Output Format (JSON Array):
    [
      { "category": "health", "content": "Drink 1 cup of water", "verification_type": "image" },
      { "category": "mindset", "content": "Smile at yourself in mirror", "verification_type": "camera" },
      { "category": "social", "content": "Send a heart emoji to friend", "verification_type": "text" },
      ...
    ]
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a personalized habit coach. Output strictly valid JSON.
                    For EACH active goal category, generate exactly 3 simple daily missions.
                    The output should be a flat JSON array of mission objects.
                    Each mission object must have "category", "content", and "verification_type" fields.
                    Valid values for "verification_type" are "text", "image", or "camera".
                    Assign "text" for writing, thinking, or social messaging tasks.
                    Assign "image" or "camera" for physical activities, cleaning, or verifiable actions.
                    Ensure the content is written in ${language === 'ko' ? 'Korean' : 'English'}.
                    `
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-3.5-turbo",
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        const parsed = JSON.parse(content || "[]");
        return parsed as MissionData[];
    } catch (e) {
        console.error("AI Generation Failed", e);
        return MOCK_MISSIONS;
    }
}

export async function generateCoaching(user: any, goal: any, stats: any, language: string = 'en') {
    if (!apiKey || apiKey.includes('YOUR_OPENAI')) {
        return {
            insight: language === 'ko' ? "꾸준함이 성공의 열쇠입니다!" : "Keep consistent! Consistency is key to success.",
            encouragement: language === 'ko' ? "잘하고 있어요, 계속 힘내세요!" : "You are doing great, keep it up!"
        };
    }

    if (!user || !goal) return {
        insight: language === 'ko' ? "계속해보세요! 잘하고 있습니다." : "Keep going! You're doing great.",
        encouragement: language === 'ko' ? "자신을 믿으세요!" : "Believe in yourself!"
    };

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

    const prompt = `
        Analyze this user's progress on their goal: "${goal.target_text}" (Category: ${goal.category}).
        Stats:
        - Total Missions Attempted: ${stats.total}
        - Success Rate: ${stats.successRate}%
        - Current Streak: ${stats.streak} days
        - Recent Activity: ${JSON.stringify(stats.recentHistory)}

        As an Expert Performance Coach, provide:
        1. "insight": A specific, tactical advice based on their data (max 2 sentences).
        2. "encouragement": A short, powerful motivating phrase (max 1 sentence).

        Output JSON: { "insight": "...", "encouragement": "..." }
        Language: ${language === 'ko' ? "Korean" : "English"}.
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a warm but sharp performance coach. Output strictly valid JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-3.5-turbo",
            max_tokens: 150,
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        return JSON.parse(content || '{}');
    } catch (e) {
        console.error("Coaching Generation Failed", e);
        return {
            insight: language === 'ko' ? "데이터가 부족하지만, 꾸준함이 답입니다. 조금만 더 힘내세요!" : "Not enough data, but consistency is key. Keep going!",
            encouragement: language === 'ko' ? "당신의 잠재력을 믿으세요!" : "Believe in your potential!"
        };
    }
}
