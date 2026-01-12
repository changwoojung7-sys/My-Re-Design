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

export async function generateMissions(userProfile: any, language: 'en' | 'ko' = 'en', excludedMissions: string[] = []): Promise<MissionData[]> {
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
    Context: User is ${userProfile.age || 25} years old ${userProfile.gender || 'adult'}.
    Language: ${language === 'ko' ? 'Korean' : 'English'}
    
    Active Goals:
    ${goalList}

    Task:
    For EACH active goal category listed above, create exactly 3 simple daily missions.
    - The missions must be relevant to the specific goal details.
    - Doable in < 15 mins.
    - Output the content in ${language === 'ko' ? 'Korean' : 'English'}.

    EXCLUSION RULES (IMPORTANT):
    - Do NOT generate missions that are identical or very similar to the following recent missions:
    ${excludedMissions.length > 0 ? excludedMissions.map(m => `- ${m}`).join('\n') : "(No exclusions)"}
    - Note: This exclusion applies strictly to categories: Vitality, Social, Mindset.
    - For Health, Growth, Career categories, you MAY repeat tasks if they are essential (e.g. "Do 10 squats"), but try to vary slightly if possible.
    
    Category Specific Guidelines:
    1. health: 
       - CRITICAL: Check 'Details: current_status' if provided. Tailor missions to this condition (e.g. if 'knee injury', avoid jumping; if 'beginner', keep it light).
       - Focus on physical vitality, diet, sleep, or small exercises relevant to their status (e.g. squats, water, stretching). Repeats allowed.
    2. growth: Focus on learning, reading, or practicing a skill (e.g. read 1 page, practice 10 mins). Repeats allowed.
    3. mindset: Focus on mental health, gratitude, or affirmation. AVOID REPEATS from exclusion list.
    4. career: Focus on work efficiency, planning, or financial check. Repeats allowed.
    5. social: Focus on connection and relationships. AVOID REPEATS from exclusion list.
    6. vitality: Focus on hobbies, recharging, or cleaning. AVOID REPEATS from exclusion list.

    Output Format (JSON Array):
    [
      { "category": "health", "content": "Squat 10 times", "verification_type": "image" },
      { "category": "mindset", "content": "Write 3 things grateful for", "verification_type": "text" },
      { "category": "social", "content": "Send a text to a friend", "verification_type": "text" },
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

export async function generateCoaching(user: any, goal: any, stats: any, language: 'en' | 'ko' = 'en') {
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
