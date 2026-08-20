import { supabase } from './supabase';

// Intelligent 3-Mission Generator for Demo & Fallback
function generateDynamicCategoryMissions(category: string, goalText: string = '', language: string = 'ko'): MissionData[] {
    const text = (goalText || '').toLowerCase();
    const isKo = language === 'ko';

    if (category === 'body_wellness') {
        if (text.includes('팔굽혀펴기') || text.includes('푸시업') || text.includes('pushup')) {
            return [
                {
                    category: 'body_wellness',
                    content: isKo ? '정자세로 팔굽혀펴기 20회 1세트 완료하기' : 'Complete 1 set of 20 strict push-ups',
                    verification_type: 'image',
                    reasoning: { expected_impact: isKo ? '상체 근력과 코어 안정성을 높이는 기본 루틴입니다.' : 'Core upper body strength booster.' },
                    trust_score: 98
                },
                {
                    category: 'body_wellness',
                    content: isKo ? '가슴 및 어깨 스트레칭 5분 진행하기' : '5-minute chest & shoulder stretch',
                    verification_type: 'checkbox',
                    reasoning: { expected_impact: isKo ? '운동 전후 부상 방지 및 근육 회복을 돕습니다.' : 'Prevents stiffness and aids recovery.' },
                    trust_score: 95
                },
                {
                    category: 'body_wellness',
                    content: isKo ? '추가 팔굽혀펴기 15회 및 수분 500ml 섭취' : 'Complete 15 more push-ups & drink 500ml water',
                    verification_type: 'image',
                    reasoning: { expected_impact: isKo ? '점진적 과부하로 목표 달성을 가속화합니다.' : 'Progressive overload for target achievement.' },
                    trust_score: 96
                }
            ];
        }
        if (text.includes('러닝') || text.includes('달리기') || text.includes('런닝') || text.includes('run')) {
            return [
                {
                    category: 'body_wellness',
                    content: isKo ? '가벼운 페이스로 3km 아침 조깅하기' : 'Run 3km at an easy pace',
                    verification_type: 'image',
                    reasoning: { expected_impact: isKo ? '심폐 지구력 향상 및 활기찬 에너지 충전' : 'Cardio boost and energy ignition.' },
                    trust_score: 98
                },
                {
                    category: 'body_wellness',
                    content: isKo ? '하체 햄스트링 & 종아리 스트레칭 5분' : '5-minute leg & calf stretching',
                    verification_type: 'checkbox',
                    reasoning: { expected_impact: isKo ? '관절 보호 및 유연성 확보' : 'Joint protection and mobility.' },
                    trust_score: 95
                },
                {
                    category: 'body_wellness',
                    content: isKo ? '러닝 후 충분한 수분 섭취 및 단백질 식단' : 'Hydrate & enjoy a healthy recovery snack',
                    verification_type: 'image',
                    reasoning: { expected_impact: isKo ? '근육 피로 회복 및 체력 강화' : 'Muscle recovery and endurance building.' },
                    trust_score: 96
                }
            ];
        }
        // General Body Wellness (3 missions)
        return [
            {
                category: 'body_wellness',
                content: isKo ? '기상 직후 따뜻한 물 500ml 마시기' : 'Drink 500ml warm water upon waking',
                verification_type: 'image',
                reasoning: { expected_impact: isKo ? '신진대사 활성화 및 장 건강 촉진' : 'Boosts metabolism and morning hydration.' },
                trust_score: 97
            },
            {
                category: 'body_wellness',
                content: isKo ? '전신 활력 스트레칭 10분 진행' : '10-minute full body vitality stretch',
                verification_type: 'checkbox',
                reasoning: { expected_impact: isKo ? '혈액 순환 촉진 및 긴장 완화' : 'Improves blood flow and relieves tension.' },
                trust_score: 95
            },
            {
                category: 'body_wellness',
                content: isKo ? '스쿼트 20회 2세트 & 바른 자세 유지' : 'Complete 2 sets of 20 squats',
                verification_type: 'image',
                reasoning: { expected_impact: isKo ? '하체 근력 및 코어 강화' : 'Builds lower body strength.' },
                trust_score: 96
            }
        ];
    }

    if (category === 'growth_career') {
        return [
            {
                category: 'growth_career',
                content: isKo ? '목표 관련 서적 20페이지 집중해서 읽기' : 'Read 20 pages of a career book',
                verification_type: 'image',
                reasoning: { expected_impact: isKo ? '전문 지식 확장 및 매일의 독서 습관 형성' : 'Broadens expertise and builds daily reading habit.' },
                trust_score: 98
            },
            {
                category: 'growth_career',
                content: isKo ? '오늘 배운 핵심 인사이트 3줄 요약 노트 작성' : 'Write a 3-bullet summary of key insights',
                verification_type: 'text',
                reasoning: { expected_impact: isKo ? '배운 내용을 체계적으로 내재화합니다.' : 'Solidifies learning through active recall.' },
                trust_score: 95
            },
            {
                category: 'growth_career',
                content: isKo ? '1시간 집중 업무/프로젝트 실무 실행' : '1 hour of focused deep work on your project',
                verification_type: 'image',
                reasoning: { expected_impact: isKo ? '생산성 극대화 및 실질적 성과 창출' : 'Drives meaningful tangible progress.' },
                trust_score: 96
            }
        ];
    }

    if (category === 'mind_connection') {
        return [
            {
                category: 'mind_connection',
                content: isKo ? '호흡에 집중하는 마음챙김 명상 5분' : '5-minute mindful breathing meditation',
                verification_type: 'checkbox',
                reasoning: { expected_impact: isKo ? '스트레스 감소 및 맑은 정신 유지' : 'Reduces anxiety and clarifies focus.' },
                trust_score: 97
            },
            {
                category: 'mind_connection',
                content: isKo ? '오늘 감사했던 순간 3가지 기록하기' : 'Write down 3 things you are grateful for',
                verification_type: 'text',
                reasoning: { expected_impact: isKo ? '긍정적인 사고방식과 회복탄력성 향상' : 'Fosters optimism and mental resilience.' },
                trust_score: 95
            },
            {
                category: 'mind_connection',
                content: isKo ? '햇살을 받으며 15분 동안 조용히 산책하기' : 'Take a peaceful 15-minute sunshine walk',
                verification_type: 'image',
                reasoning: { expected_impact: isKo ? '세로토닌 분비 촉진 및 자연과의 교감' : 'Boosts serotonin and reconnects with nature.' },
                trust_score: 96
            }
        ];
    }

    if (category === 'funplay') {
        if (text.includes('명상') || text.includes('meditation') || text.includes('호흡') || text.includes('마음')) {
            return [
                {
                    category: 'funplay',
                    content: isKo ? '바른 자세로 앉아 눈을 감고 3분간 들숨과 날숨에만 집중하기' : '3-minute mindful breathing meditation in a comfortable posture',
                    verification_type: 'checkbox',
                    reasoning: { expected_impact: isKo ? '뇌파를 안정시키고 아침의 잡념을 비워 집중력을 극대화합니다.' : 'Calms the mind and enhances morning clarity.' },
                    trust_score: 98
                },
                {
                    category: 'funplay',
                    content: isKo ? '주변의 3가지 자연 소리(바람, 새소리, 발걸음 등)에 1분간 귀 기울이기' : 'Listen attentively to 3 ambient sounds for 1 minute',
                    verification_type: 'checkbox',
                    reasoning: { expected_impact: isKo ? '청각적 현존감을 깨우고 감각 주의력을 높여줍니다.' : 'Awakens sensory presence and mindful focus.' },
                    trust_score: 96
                },
                {
                    category: 'funplay',
                    content: isKo ? '명상 후 지금 마음에 떠오른 긍정적인 단어 1개 메모하기' : 'Write down one positive word that came up after meditation',
                    verification_type: 'text',
                    reasoning: { expected_impact: isKo ? '마음의 평온함을 하루 동안 유지하는 앵커링 효과를 줍니다.' : 'Anchors inner peace throughout the day.' },
                    trust_score: 97
                }
            ];
        }

        // Default FunPlay (3 dynamic 30s challenges)
        const shuffled = [...FUNPLAY_MISSIONS_KO].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3).map((item, idx) => ({
            category: 'funplay' as const,
            content: isKo ? item.content : `30s challenge: ${item.content}`,
            verification_type: item.verification_type,
            reasoning: { expected_impact: item.reasoning },
            trust_score: 95 + idx
        }));
    }

    // Default Fallback
    return [
        {
            category: 'funplay',
            content: isKo ? '창밖을 바라보며 30초 동안 깊은 복식호흡 3회 진행' : '30-second deep breathing while looking outside',
            verification_type: 'checkbox',
            reasoning: { expected_impact: isKo ? '자율신경계를 안정시키고 활력을 줍니다.' : 'Restores energy and calmness.' },
            trust_score: 96
        }
    ];
}

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
    language: string = 'ko',
    _excludedMissions: string[] = [],
    targetGoal: any = null,
    refresh: boolean = false
): Promise<MissionData[]> {

    const category = targetGoal?.category || 'body_wellness';
    const targetText = targetGoal?.target_text || '';

    // We only need the categories/goals structure. Detailed history is now fetched server-side via Fingerprints.
    const goalList = targetGoal ? {
        [targetGoal.category]: targetGoal.target_text
    } : {};

    try {
        console.log('[DEBUG openai.ts] Calling generate-mission Edge Function...');
        const { data, error } = await supabase.functions.invoke('generate-mission', {
            body: {
                type: 'daily_missions',
                payload: {
                    userProfile: {
                        id: userProfile?.id,
                        age: userProfile?.age,
                        gender: userProfile?.gender,
                        height: userProfile?.height,
                        weight: userProfile?.weight,
                        job: userProfile?.job,
                        condition_today: userProfile?.condition_today
                    },
                    language,
                    goalList,
                    refresh,
                    refreshCategory: targetGoal?.category || null
                }
            }
        });

        console.log('[DEBUG openai.ts] Edge Function response:', { data, error });

        if (error) throw error;

        const missions = data?.missions || (Array.isArray(data) ? data : []);
        if (missions.length >= 3) {
            return missions;
        }

        // If returned fewer than 3 missions, fill with dynamic missions
        const dynamicFallbacks = generateDynamicCategoryMissions(category, targetText, language);
        return dynamicFallbacks;

    } catch (e: any) {
        console.error("AI Generation (Edge) Failed - fallback to dynamic generator:", e);

        if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('Refresh limit')) {
            alert("하루 미션 변경 횟수(3회)를 모두 사용했습니다. 내일 다시 시도해주세요!");
            return [];
        }

        // Return 3 tailored missions
        return generateDynamicCategoryMissions(category, targetText, language);
    }
}

// Rich Dynamic FunPlay Pool (30+ Creative 30-Second Missions)
const FUNPLAY_MISSIONS_KO: { content: string; reasoning: string; verification_type: string }[] = [
    { content: "비우세손(왼손)으로 좋아하는 동물 30초 동안 그리기", reasoning: "우뇌 자극 및 창의적 유연성을 즉각적으로 높여줍니다.", verification_type: "image" },
    { content: "주변에서 초록색/빨간색 물건 3개 30초 안에 찾아 터치하기", reasoning: "시각 집중력과 빠른 공간 인지 순발력을 깨워줍니다.", verification_type: "checkbox" },
    { content: "눈 감고 한 발로 15초 동안 균형 잡기 챌린지", reasoning: "고유수용성 감각과 신체 코어 밸런스를 향상시킵니다.", verification_type: "checkbox" },
    { content: "창밖을 바라보며 30초 동안 깊은 복식호흡 3회 진행", reasoning: "자율신경계를 안정시키고 뇌에 신선한 산소를 공급합니다.", verification_type: "checkbox" },
    { content: "거울을 보며 10초 동안 가장 밝은 미소 지어보기", reasoning: "안면 피드백 효과로 도파민과 엔도르핀을 분비시킵니다.", verification_type: "checkbox" },
    { content: "좋아하는 신나는 음악 1곡 틀고 30초 동안 리듬 타기", reasoning: "청각 자극과 가벼운 신체 리듬으로 기분을 전환합니다.", verification_type: "checkbox" },
    { content: "종이 한 장으로 30초 만에 가장 멀리 날아갈 비행기 접기", reasoning: "소근육 협응력과 순간적인 집중력을 자극합니다.", verification_type: "image" },
    { content: "오늘 하루 나를 칭찬하는 한 마디를 소리 내어 외치기", reasoning: "자기 긍정 확언을 통해 자존감과 활력을 충전합니다.", verification_type: "checkbox" },
    { content: "양손 엄지와 검지로 번갈아 계단 오르기 20회", reasoning: "좌우 뇌신경 교차 자극으로 인지 민첩성을 높입니다.", verification_type: "checkbox" },
    { content: "주변에서 '둥근 모양' 물건 3가지 20초 만에 찾아보기", reasoning: "관찰력과 탐색 집중력을 단시간에 활성화합니다.", verification_type: "checkbox" },
    { content: "30초 동안 어깨를 으쓱으쓱 올렸다 내리기 15회", reasoning: "승모근 긴장을 풀고 상체 혈액 순환을 돕습니다.", verification_type: "checkbox" },
    { content: "물 한 컵을 천천히 음미하며 30초 동안 마시기", reasoning: "마인드풀 섭취로 신체 수분 밸런스와 안정감을 회복합니다.", verification_type: "checkbox" },
    { content: "손바닥을 20초 동안 빠르게 비벼 따뜻해진 손 눈 위에 얹기", reasoning: "눈의 피로를 즉각 완화하고 시신경을 편안하게 합니다.", verification_type: "checkbox" },
    { content: "지금 떠오르는 기분 좋은 단어 3개 메모장에 적기", reasoning: "긍정 어휘 활성화를 통해 밝은 뇌파 상태를 유도합니다.", verification_type: "text" },
    { content: "의자에 앉은 채로 두 발을 띄워 15초 버티기", reasoning: "하복부 코어 근육에 순간적인 활성 자극을 줍니다.", verification_type: "checkbox" }
];

export async function generateFunPlayMissions(
    userProfile: any,
    language: string = 'ko',
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

        if (!error && data?.missions && Array.isArray(data.missions) && data.missions.length >= 3) {
            return data.missions.map((m: any) => ({
                category: 'funplay' as const,
                content: m.content || m.mission || "30초 재미있는 챌린지 실행",
                verification_type: m.verification_type || 'checkbox',
                reasoning: m.reasoning || { expected_impact: "기분 전환과 즉각적인 도파민 부스팅" },
                trust_score: m.trust_score || 95,
                details: m
            }));
        }
    } catch (e: any) {
        console.warn("FunPlay Edge Invocation fallback to dynamic local pool:", e);
    }

    // Dynamic Random Selector (Shuffles and guarantees 3 unique fresh missions every time)
    const shuffled = [...FUNPLAY_MISSIONS_KO].sort(() => Math.random() - 0.5);
    const selected3 = shuffled.slice(0, 3);

    return selected3.map((item, idx) => ({
        category: 'funplay' as const,
        content: language === 'ko' ? item.content : `30-second challenge #${idx + 1}: ${item.content}`,
        verification_type: item.verification_type,
        reasoning: { expected_impact: item.reasoning },
        trust_score: 95 + idx,
        details: { time_limit: options?.time_limit || 30, mood: options?.mood || 'fun' }
    }));
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
                    language,
                    condition_today: user?.condition_today
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
