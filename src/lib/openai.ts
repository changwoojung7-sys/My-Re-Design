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

export async function generateMissions(
    userProfile: any,
    language: string = 'en',
    _excludedMissions: string[] = [],
    targetGoal: any = null,
    refresh: boolean = false
): Promise<MissionData[]> {

    // We only need the categories/goals structure. Detailed history is now fetched server-side via Fingerprints.
    const goalList = targetGoal ? {
        [targetGoal.category]: targetGoal.target_text
    } : {}; // If null, the Edge Function will fallback to default profile goals

    try {
        console.log('[DEBUG openai.ts] Calling generate-mission Edge Function...');
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'daily_missions',
                payload: {
                    userProfile: {
                        age: userProfile.age,
                        gender: userProfile.gender,
                        id: userProfile.id
                    },
                    language,
                    goalList,
                    refresh
                }
            }
        });

        console.log('[DEBUG openai.ts] Edge Function response:', { data, error });

        if (error) throw error;

        // The Edge Function returns the 'missions' array directly or within the object
        const missions = data?.missions || (Array.isArray(data) ? data : []);
        return missions.length > 0 ? missions : MOCK_MISSIONS;

    } catch (e) {
        console.error("AI Generation (Edge) Failed - FULL ERROR:", e);
        console.error("Error type:", typeof e, "Error keys:", e && typeof e === 'object' ? Object.keys(e) : 'N/A');
        return MOCK_MISSIONS;
    }
}

export async function generateFunPlayMission(
    userProfile: any,
    language: string = 'en',
    _excludedKeywords: string[] = [],
    options: { difficulty: string, time_limit: number, mood: string, place: string },
    refresh: boolean = false
): Promise<MissionData> {

    try {
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'funplay',
                payload: {
                    userProfile,
                    options,
                    language,
                    refresh
                }
            }
        });

        if (error) throw error;

        // Normalize response
        return {
            category: 'funplay',
            content: data.content || data.mission || "Mission Generation Failed",
            verification_type: 'checkbox',
            reasoning: data.reasoning || { expected_impact: "Instant Fun" },
            trust_score: data.trust_score || 95,
            details: data // Store fingerprint and other fields
        };

    } catch (e) {
        console.error("FunPlay Generation (Edge) Failed", e);
        return {
            category: 'funplay',
            content: language === 'ko' ? "비우세손으로 30초 동안 그림 그리기" : "Draw with non-dominant hand for 30s",
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
