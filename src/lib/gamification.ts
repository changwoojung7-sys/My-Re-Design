import { supabase } from './supabase';

// ================================================================
//  Level 정의 테이블
// ================================================================
export const LEVEL_TABLE: { level: number; title: string; minXp: number }[] = [
    { level:  1, title: '비기너',           minXp:     0 },
    { level:  2, title: '루키 습관러',       minXp:    50 },
    { level:  3, title: '꾸준한 도전자',     minXp:   120 },
    { level:  4, title: '루틴 빌더',         minXp:   220 },
    { level:  5, title: '루틴 탐험가',       minXp:   350 },
    { level:  6, title: '해빗 메이커',       minXp:   520 },
    { level:  7, title: '성장 추구자',       minXp:   730 },
    { level:  8, title: '컨시스턴트',        minXp:   980 },
    { level:  9, title: '모멘텀 라이더',     minXp:  1280 },
    { level: 10, title: '해빗 빌더',         minXp:  1630 },
    { level: 11, title: '에너지 마스터',     minXp:  2030 },
    { level: 12, title: '라이프 크래프터',   minXp:  2480 },
    { level: 13, title: '루틴 아키텍트',     minXp:  2980 },
    { level: 14, title: '라이프 스타일러',   minXp:  3530 },
    { level: 15, title: '라이프 크리에이터', minXp:  4130 },
    { level: 16, title: '바이탈리티 코치',   minXp:  4780 },
    { level: 17, title: '퍼포먼스 가이드',   minXp:  5480 },
    { level: 18, title: '그로스 비저너리',   minXp:  6230 },
    { level: 19, title: '마스터 플래너',     minXp:  7030 },
    { level: 20, title: '라이프 아키텍트',   minXp:  7880 },
];

// ================================================================
//  XP 기반 레벨/타이틀 계산
// ================================================================
export function calcLevelFromXp(totalXp: number): {
    level: number;
    title: string;
    currentLevelXp: number;
    nextLevelXp: number | null;
    progressPercent: number;
} {
    let result = LEVEL_TABLE[0];
    for (const row of LEVEL_TABLE) {
        if (totalXp >= row.minXp) result = row;
        else break;
    }

    const nextRow = LEVEL_TABLE.find(r => r.level === result.level + 1) ?? null;
    const currentLevelXp = result.minXp;
    const nextLevelXp    = nextRow ? nextRow.minXp : null;

    const progressPercent = nextLevelXp
        ? Math.min(100, Math.round(((totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100))
        : 100;

    return { level: result.level, title: result.title, currentLevelXp, nextLevelXp, progressPercent };
}

// ================================================================
//  XP 지급 함수 (미션 완료 시 호출)
// ================================================================
export async function grantMissionXp(
    userId: string,
    missionId: string,
    xpReward: number = 10
): Promise<{ newTotalXp: number; leveledUp: boolean; newLevel: number; newTitle: string }> {
    await supabase.from('xp_logs').insert({
        user_id: userId,
        amount:  xpReward,
        reason:  'mission_complete',
        ref_id:  missionId,
    });

    const { data: profile } = await supabase
        .from('profiles')
        .select('total_xp, current_level')
        .eq('id', userId)
        .single();

    const oldXp    = profile?.total_xp    ?? 0;
    const oldLevel = profile?.current_level ?? 1;
    const newXp    = oldXp + xpReward;

    const { level, title } = calcLevelFromXp(newXp);
    const leveledUp = level > oldLevel;

    await supabase.from('profiles').update({
        total_xp:      newXp,
        current_level: level,
        level_title:   title,
    }).eq('id', userId);

    return { newTotalXp: newXp, leveledUp, newLevel: level, newTitle: title };
}

// ================================================================
//  스트릭 보너스 XP 지급
// ================================================================
export async function grantStreakBonusXp(userId: string, streak: number) {
    let bonus = 0;
    if (streak === 7)  bonus = 30;
    if (streak === 14) bonus = 60;
    if (streak === 30) bonus = 120;
    if (streak % 30 === 0 && streak > 30) bonus = 80;
    if (!bonus) return;

    await supabase.from('xp_logs').insert({
        user_id: userId,
        amount:  bonus,
        reason:  'streak_bonus',
    });

    const { data: profile } = await supabase
        .from('profiles')
        .select('total_xp, current_level')
        .eq('id', userId)
        .single();

    const oldXp    = profile?.total_xp    ?? 0;
    const oldLevel = profile?.current_level ?? 1;
    const newXp    = oldXp + bonus;
    const { level, title } = calcLevelFromXp(newXp);

    await supabase.from('profiles').update({
        total_xp:      newXp,
        current_level: level,
        level_title:   title,
    }).eq('id', userId);

    return { bonus, leveledUp: level > oldLevel };
}

// ================================================================
//  뱃지 달성 체크
// ================================================================
export async function checkAndAwardBadges(userId: string, missions: any[]) {
    const { data: earned } = await supabase
        .from('user_badges')
        .select('badge_id, badges(key)')
        .eq('user_id', userId);

    const earnedKeys = new Set((earned ?? []).map((ub: any) => ub.badges?.key));

    const { data: allBadges } = await supabase
        .from('badges')
        .select('*');

    if (!allBadges) return [];

    const now = new Date();
    const newlyEarned: string[] = [];

    for (const badge of allBadges) {
        if (earnedKeys.has(badge.key)) continue;

        const cond = badge.condition as any;
        let achieved = false;

        switch (cond?.type) {
            case 'total_missions':
                achieved = missions.filter((m: any) => m.is_completed).length >= cond.threshold;
                break;
            case 'category_count':
                achieved = missions.filter((m: any) => m.is_completed && m.category === cond.category).length >= cond.threshold;
                break;
            case 'streak': {
                const byDate: Record<string, boolean> = {};
                missions.forEach((m: any) => { if (m.is_completed) byDate[m.date] = true; });
                let streak = 0;
                for (let i = 0; i < 365; i++) {
                    const d = new Date(); d.setDate(now.getDate() - i);
                    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    if (byDate[ymd]) streak++;
                    else if (i === 0) continue;
                    else break;
                }
                achieved = streak >= cond.threshold;
                break;
            }
            case 'early_complete': {
                const earlyCount = missions.filter((m: any) => {
                    if (!m.is_completed || !m.created_at) return false;
                    return new Date(m.created_at).getHours() < (cond.before_hour ?? 7);
                }).length;
                achieved = earlyCount >= cond.threshold;
                break;
            }
        }

        if (achieved) {
            await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id });
            newlyEarned.push(badge.key);
        }
    }

    return newlyEarned;
}
