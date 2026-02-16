// import OpenAI from 'openai'; // Removed to secure key
import { supabase } from './supabase';

// Mock missions for fallback
const MOCK_MISSIONS: MissionData[] = [
    { category: 'body_wellness', content: 'Do 10 squats.' },
    { category: 'growth_career', content: 'Read one page of a book.' },
    { category: 'mind_connection', content: 'Takes 3 deep breaths.' }
];

export interface MissionData {
    category: 'body_wellness' | 'growth_career' | 'mind_connection' | 'funplay';
    content: string;
    verification_type?: string;
    reasoning?: {
        user_context?: string;
        scientific_basis?: string;
        expected_impact?: string;
    };
    trust_score?: number;
    details?: any; // For flexible extra data like FunPlay difficulty
}

export async function generateMissions(userProfile: any, language: string = 'en', excludedMissions: string[] = [], targetGoal: any = null): Promise<MissionData[]> {
    // Note: We no longer check for strict API Key on client side since we use Edge Function.
    // However, if Edge Function requires it, it manages it securely.

    let goalsToProcess = [];

    if (targetGoal) {
        goalsToProcess = [targetGoal];
    } else {
        // Fetch User Goals from DB if no target provided
        const { data: userGoals } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', userProfile.id);

        if (!userGoals || userGoals.length === 0) {
            console.log("No detailed goals found, using mocks");
            return MOCK_MISSIONS;
        }
        goalsToProcess = userGoals;
    }


    const goalList = goalsToProcess.map((g: any) =>
        `- Category: ${g.category}\n  Goal: ${g.target_text}\n  Details: ${JSON.stringify(g.details)}`
    ).join('\n\n');

    // Fetch Recent 3 Days Missions (for context awareness)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const { data: recentMissionsData } = await supabase
        .from('missions')
        .select('content, category, date')
        .eq('user_id', userProfile.id)
        .gte('date', threeDaysAgo.toISOString().split('T')[0]);

    const recentMissions = recentMissionsData?.map(m => `[${m.category}] ${m.content} (${m.date})`).join('\n') || "";

    try {
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'daily_missions',
                payload: {
                    userProfile,
                    language,
                    excludedMissions,
                    goalList,
                    recentMissions // Pass recent history
                }
            }
        });

        if (error) throw error;
        // Edge Function returns { missions: [...] }
        const missions = data?.missions || [];
        return Array.isArray(missions) ? missions : MOCK_MISSIONS;

    } catch (e) {
        console.error("AI Generation (Edge) Failed", e);
        return MOCK_MISSIONS;
    }
}

export async function generateFunPlayMission(
    _userProfile: any,
    language: string = 'en',
    excludedKeywords: string[] = [],
    options: { difficulty: string, time_limit: number, mood: string, place: string }
): Promise<MissionData> {

    // Fetch Recent 3 Days Missions (for context awareness)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const { data: recentMissionsData } = await supabase
        .from('missions')
        .select('content, category, date, details')
        .eq('user_id', _userProfile.id)
        .gte('date', threeDaysAgo.toISOString().split('T')[0]);

    const recentMissions = recentMissionsData?.map(m => {
        const archetype = m.details?.archetype ? ` (Archetype: ${m.details.archetype})` : '';
        return `[${m.category}] ${m.content}${archetype} (${m.date})`;
    }).join('\n') || "";

    try {
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'funplay',
                payload: {
                    userProfile: _userProfile,
                    options,
                    language,
                    excludedKeywords,
                    recentMissions,
                    randomSeed: Math.random() // Force variety
                }
            }
        });

        if (error) throw error;

        // Normalize response from Edge Function
        // Edge returns pure JSON object from OpenAI
        const parsed = data;

        return {
            category: 'funplay',
            content: parsed.content || parsed.mission || "Mission Generation Failed",
            verification_type: 'checkbox',
            reasoning: parsed.reasoning || { expected_impact: "Instant Refresh" },
            trust_score: parsed.trust_score || 90,
            details: parsed // Store extra fields if needed
        };

    } catch (e) {
        console.error("FunPlay Generation (Edge) Failed", e);
        return {
            category: 'funplay',
            content: language === 'ko' ? "30초 동안 제자리 뛰기" : "Jump in place for 30 seconds",
            verification_type: 'checkbox'
        };
    }
}

export async function generateCoaching(user: any, goal: any, stats: any, language: string = 'en') {
    if (!user || !goal) return {
        insight: language === 'ko' ? "계속해보세요! 잘하고 있습니다." : "Keep going! You're doing great.",
        encouragement: language === 'ko' ? "자신을 믿으세요!" : "Believe in your potential!"
    };

    try {
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'coaching',
                payload: {
                    goal,
                    stats,
                    language
                }
            }
        });

        if (error) throw error;
        return data; // Expected { insight, encouragement }

    } catch (e) {
        console.error("Coaching Generation (Edge) Failed", e);
        return {
            insight: language === 'ko' ? "데이터가 부족하지만, 꾸준함이 답입니다. 조금만 더 힘내세요!" : "Not enough data, but consistency is key. Keep going!",
            encouragement: language === 'ko' ? "당신의 잠재력을 믿으세요!" : "Believe in your potential!"
        };
    }
}
