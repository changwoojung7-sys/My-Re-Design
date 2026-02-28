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
                    refresh,
                    refreshCategory: targetGoal?.category || null  // 서버 Edge Function의 payload.refreshCategory와 매칭
                }
            }
        });

        console.log('[DEBUG openai.ts] Edge Function response:', { data, error });

        if (error) throw error;

        // The Edge Function returns the 'missions' array directly or within the object
        const missions = data?.missions || (Array.isArray(data) ? data : []);
        return missions.length > 0 ? missions : MOCK_MISSIONS;

    } catch (e: any) {
        console.error("AI Generation (Edge) Failed - FULL ERROR:", e);
        console.error("Error type:", typeof e, "Error keys:", e && typeof e === 'object' ? Object.keys(e) : 'N/A');

        if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('Refresh limit')) {
            alert("하루 미션 변경 횟수(3회)를 모두 사용했습니다. 내일 다시 시도해주세요!");
            return [];
        }

        return MOCK_MISSIONS;
    }
}

export async function generateFunPlayMissions(
    userProfile: any,
    language: string = 'en',
    _excludedKeywords: string[] = [],
    options: { difficulty: string, time_limit: number, mood: string, place: string },
    refresh: boolean = false
): Promise<MissionData[]> {

    try {
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'funplay',
                payload: {
                    userProfile,
                    options,
                    language,
                    refresh,
                    refreshCategory: 'funplay'
                }
            }
        });

        if (error) throw error;

        // Edge Function now returns { missions: [...] } with 3 funplay missions
        const missions = data?.missions || (Array.isArray(data) ? data : [data]);
        return missions.map((m: any) => ({
            category: 'funplay' as const,
            content: m.content || m.mission || "Mission Generation Failed",
            verification_type: 'checkbox',
            reasoning: m.reasoning || { expected_impact: "Instant Fun" },
            trust_score: m.trust_score || 95,
            details: m
        }));

    } catch (e: any) {
        console.error("FunPlay Generation (Edge) Failed", e);

        if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('Refresh limit')) {
            alert("하루 미션 변경 횟수(3회)를 모두 사용했습니다. 내일 다시 시도해주세요!");
            return [];
        }

        return [
            { category: 'funplay', content: language === 'ko' ? "비우세손으로 30초 동안 그림 그리기" : "Draw with non-dominant hand for 30s", verification_type: 'checkbox' },
            { category: 'funplay', content: language === 'ko' ? "주변에서 빨간색 3개 찾기" : "Find 3 red objects around you", verification_type: 'checkbox' },
            { category: 'funplay', content: language === 'ko' ? "눈 감고 10초 동안 균형 잡기" : "Balance with eyes closed for 10s", verification_type: 'checkbox' }
        ];
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
