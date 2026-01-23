import OpenAI from 'openai';
import { supabase } from './supabase';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

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
    - Note: This exclusion applies primarily to daily routine type tasks.
    
    Category Specific Guidelines (Merged Definitions):
    
    1. body_wellness (Health & Vitality):
       - Combines Physical Health + Daily Vitality/Hobbies.
       - Rules: 
         * Analyze 'Goal Details' (Height/Weight) OR 'Hobby/Routine'.
         * Mix: 1 Physical Task (e.g. Squat, Stretch) + 1 Vitality Task (e.g. Drink water, Sun exposure) + 1 Fun/Hobby Task.
         * If goal is diet/exercise, focus on physical. If goal is routine/happiness, focus on vitality.
       - TIME: Generally < 3 mins. Exception: Running/Cardio up to 15 mins if explicitly set.

    2. growth_career (Growth & Career):
       - Combines Self-Development + Professional Work.
       - Rules:
         * Analyze 'Topic', 'Current Level', 'Project Name', 'KPI'.
         * Focus on micro-actions: Read 1 page, Check 1 email, Plan tomorrow's to-do.
         * Bridge the gap between 'Current Status' and 'Target Goal'.

    3. mind_connection (Mindset & Social):
       - Combines Inner Peace + Social Connection.
       - Rules:
         * Analyze 'Mood', 'Affirmation' OR 'People', 'Activity'.
         * Mix: 1 Inner (e.g. Affirmation, Breathe) + 1 Social (e.g. Send nice text, Call parents).
         * If User Goal is purely social, give social tasks. If mindset, give mindset tasks.
       - Core: Comfort, Encouragement, Connection.

    Output Format (JSON Array):
    [
      { 
        "category": "body_wellness", 
        "content": "Drink 1 cup of water", 
        "verification_type": "image",
        "reasoning": {
            "user_context": "Hydration is low based on recent logs.",
            "scientific_basis": "Water boosts metabolism by 24-30%.",
            "expected_impact": "Vitality +5"
        },
        "trust_score": 95
      },
      ...
    ]
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a personalized habit coach. Output strictly valid JSON.
                    The output should be a flat JSON array of mission objects.
                    Each mission object must have "category", "content", "verification_type", "reasoning", and "trust_score".
                    "reasoning" object must contain "user_context", "scientific_basis", and "expected_impact".
                    "trust_score" should be an integer between 80 and 99.
                    Valid values for "verification_type" are "text", "image", or "camera" or "checkbox".
                    Assign "text" for writing, thinking, or social messaging tasks.
                    Assign "image" or "camera" for physical activities, cleaning, or verifiable actions.
                    Assign "checkbox" for very simple mental tasks or unverifiable quick tasks.
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

export async function generateFunPlayMission(
    userProfile: any,
    language: string = 'en',
    excludedKeywords: string[] = [],
    options: { difficulty: string, time_limit: number, mood: string, place: string }
): Promise<MissionData> {
    if (!apiKey || apiKey.includes('YOUR_OPENAI')) {
        return {
            category: 'funplay',
            content: language === 'ko' ? "30초 동안 제자리 뛰기" : "Jump in place for 30 seconds",
            verification_type: 'checkbox'
        };
    }

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

    const systemPrompt = `
    너는 "FunPlay – 30초 리얼 미션"의 미션 생성 엔진이다.
    목표는 사용자가 지금 있는 장소에서 30초~60초 안에 수행 가능한, 가볍고 재미있는 현실 미션을 만드는 것이다.

    원칙:
    - 매우 간단: 한 번 읽고 바로 할 수 있어야 한다.
    - 안전: 위험/불법/혐오/성적/자해/괴롭힘/무리한 운동/과음/운전 중 수행 금지.
    - 비용 0원: 구매/결제/외출 강요 금지.
    - 접근성: 특별한 도구 없이(휴대폰만 OK) 가능한 미션 우선.
    - 부끄러움 최소: 공공장소에서 민망하거나 타인에게 피해 주는 행동 금지.
    - 결과는 성공/실패로만 체크 가능해야 한다(정답 검증 필요 없음).
    - 텍스트는 짧고, 친근하고, 유치하지 않게.
    - 한국어로 출력. (If language is English, output English).

    금지 예시:
    - 도로에서 달리기, 계단 뛰기, 위험한 자세/스트레칭, 불특정 타인 촬영, 음주/흡연, 약물, 폭력, 혐오표현, 선정적 행동, 도박, 불법행위, 자기비하 유도.

    출력은 반드시 JSON만 반환한다(설명 문장 금지).
    Format:
    {
        "category": "funplay",
        "content": "미션 내용",
        "verification_type": "checkbox",
        "reasoning": { "expected_impact": "..." },
        "trust_score": 90
    }
    `;

    const userPrompt = `
    [미션 생성 요청]
    난이도: ${options.difficulty} (easy/normal)
    제한시간(초): ${options.time_limit}
    장소 컨텍스트: ${options.place} (home/office/outside/transit/unknown)
    분위기: ${options.mood} (calm/fun/focus)
    인증방식: checkbox
    제외하고 싶은 테마: (none)
    오늘의 중복 방지 키워드: ${excludedKeywords.join(', ')}

    요구사항:
    - 미션 1개만 생성
    - 중복 방지 키워드를 최대한 피해서 새롭게
    - 30~60초 내 완료 가능한 것
    - 제목(짧게) + 미션 설명(1~2문장) + 성공 조건(체크 가능) + 실패해도 괜찮다는 한 줄 코멘트 포함
    - 태그 3개 이내로
    - 언어: ${language === 'ko' ? 'Korean' : 'English'}
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-3.5-turbo",
            temperature: 0.9, // Higher variance for fun
        });

        const content = completion.choices[0].message.content;
        const parsed = JSON.parse(content || "{}");

        // Normalize
        return {
            category: 'funplay',
            content: parsed.content || parsed.mission || "Mission Generation Failed",
            verification_type: 'checkbox',
            reasoning: parsed.reasoning || { expected_impact: "Instant Refresh" },
            trust_score: parsed.trust_score || 90,
            details: parsed // Store extra fields if needed
        };
    } catch (e) {
        console.error("FunPlay Generation Failed", e);
        return {
            category: 'funplay',
            content: language === 'ko' ? "30초 동안 심호흡 하기" : "Take deep breaths for 30 seconds",
            verification_type: 'checkbox'
        };
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
