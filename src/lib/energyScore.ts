import { supabase } from './supabase';

export interface EnergyScore {
    category: string;
    score: number;
    fullMark: 100;
}

export async function calculateWeeklyEnergy(userId: string, missions: any[]): Promise<EnergyScore[]> {
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    const weeklyMissions = missions.filter(m => m.date >= oneWeekAgoStr && m.date <= now.toISOString().split('T')[0]);

    const categories = ['body', 'mind', 'growth', 'funplay'];
    const results: EnergyScore[] = [];

    for (const cat of categories) {
        const catMissions = weeklyMissions.filter(m => m.category === cat);
        const total = catMissions.length;
        const completed = catMissions.filter(m => m.is_completed).length;
        
        let score = 0;
        if (total > 0) {
            score = Math.round((completed / total) * 100);
        } else {
            // 미션이 아예 없는 카테고리는 점수가 없음 -> 0으로 처리하거나 기본점수
            score = 0;
        }

        results.push({
            category: cat,
            score,
            fullMark: 100
        });
    }

    // DB에 저장
    const { data: existing } = await supabase
        .from('weekly_energy_stats')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start_date', oneWeekAgoStr)
        .single();

    if (!existing) {
        await supabase.from('weekly_energy_stats').insert({
            user_id: userId,
            week_start_date: oneWeekAgoStr,
            body_score: results.find(r => r.category === 'body')?.score || 0,
            mind_score: results.find(r => r.category === 'mind')?.score || 0,
            growth_score: results.find(r => r.category === 'growth')?.score || 0,
            funplay_score: results.find(r => r.category === 'funplay')?.score || 0,
        });
    }

    return results;
}
