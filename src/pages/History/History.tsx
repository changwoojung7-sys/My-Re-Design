import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';
import { ChevronDown, Calendar, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HistoryDetail from './HistoryDetail';
import { DEMO_SAMPLE_CARDS } from '../../lib/demoImageHelper';

type GoalCategory = 'all' | 'body_wellness' | 'growth_career' | 'mind_connection' | 'funplay';

export default function History() {
    const { user } = useStore();
    const { t, language } = useLanguage();
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('all');
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed'>('active');
    const [historyGoals, setHistoryGoals] = useState<any[]>([]);
    const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
    const [missionCounts, setMissionCounts] = useState<Record<string, number>>({});
    const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
    const [activeGoals, setActiveGoals] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (user) {
            fetchMissionCounts();
            fetchCompletedCounts();
            fetchActiveGoals();
        }
    }, [user]);

    const fetchActiveGoals = async () => {
        if (user?.id === 'demo123') {
            setActiveGoals({ body_wellness: true, growth_career: true, mind_connection: true, funplay: true });
            return;
        }
        // Verify active goals by checking user_goals table
        const { data } = await supabase
            .from('user_goals')
            .select('category')
            .eq('user_id', user!.id);

        if (data) {
            const active: Record<string, boolean> = {};
            data.forEach((goal: any) => {
                if (goal.category) {
                    active[goal.category] = true;
                }
            });
            setActiveGoals(active);
        }
    };

    const fetchMissionCounts = async () => {
        if (!user) return;
        if (user.id === 'demo123') {
            setMissionCounts({ body_wellness: 3, growth_career: 3, mind_connection: 3, funplay: 1 });
            return;
        }
        const today = new Date().toISOString().split('T')[0];

        // Fetch incomplete missions for today
        const { data } = await supabase
            .from('missions')
            .select('category')
            .eq('user_id', user.id)
            .eq('date', today)
            .eq('is_completed', false);

        if (data) {
            const counts: Record<string, number> = {};
            data.forEach((m: any) => {
                const cat = m.category; // Ensure lowercase if needed
                counts[cat] = (counts[cat] || 0) + 1;
            });
            setMissionCounts(counts);
        }
    };

    const fetchCompletedCounts = async () => {
        if (!user) return;
        if (user.id === 'demo123') {
            setCompletedCounts({ 'body_wellness-1': 7, 'growth_career-1': 7, 'mind_connection-1': 7, 'funplay-1': 7 });
            return;
        }
        const { data } = await supabase
            .from('missions')
            .select('category, seq')
            .eq('user_id', user.id)
            .eq('is_completed', true);

        if (data) {
            const counts: Record<string, number> = {};
            data.forEach((m: any) => {
                const key = `${m.category}-${m.seq || 1}`;
                counts[key] = (counts[key] || 0) + 1;
            });
            setCompletedCounts(counts);
        }
    };

    useEffect(() => {
        if (user) fetchGlobalHistory();
    }, [user, selectedCategory, filterStatus]);

    const fetchGlobalHistory = async () => {
        if (user?.id === 'demo123') {
            const demoGoals = [
                {
                    id: 'demo-goal-body_wellness',
                    user_id: 'demo123',
                    category: 'body_wellness',
                    target_text: language === 'ko' ? '건강 & 활력 루틴 (10km 러닝 및 체중 감량)' : 'Healthy Body & Wellness Routine',
                    seq: 1,
                    duration_months: 1,
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_completed: filterStatus === 'completed'
                },
                {
                    id: 'demo-goal-growth_career',
                    user_id: 'demo123',
                    category: 'growth_career',
                    target_text: language === 'ko' ? '성장 & 커리어 루틴 (매일 독서 및 역량 강화)' : 'Career Growth & Skill Master Routine',
                    seq: 1,
                    duration_months: 1,
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_completed: filterStatus === 'completed'
                },
                {
                    id: 'demo-goal-mind_connection',
                    user_id: 'demo123',
                    category: 'mind_connection',
                    target_text: language === 'ko' ? '마음 & 관계 루틴 (명상 및 감사일기)' : 'Mind & Soul Peace Routine',
                    seq: 1,
                    duration_months: 1,
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_completed: filterStatus === 'completed'
                },
                {
                    id: 'demo-goal-funplay',
                    user_id: 'demo123',
                    category: 'funplay',
                    target_text: language === 'ko' ? '펀플레이 루틴 (창의적 30초 미션 게임)' : 'FunPlay Instant Challenge',
                    seq: 1,
                    duration_months: 1,
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_completed: filterStatus === 'completed'
                }
            ];

            const filtered = selectedCategory === 'all'
                ? demoGoals
                : demoGoals.filter(g => g.category === selectedCategory);
            setHistoryGoals(filtered);
            return;
        }

        let query = supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user!.id);

        if (selectedCategory !== 'all') {
            query = query.eq('category', selectedCategory);
        }

        // Fetch all candidates first (client-side filtering for calculated status)
        const { data } = await query.order('created_at', { ascending: false });

        if (data) {
            const filtered = data.filter((goal: any) => { // Type hint added
                const createdAt = new Date(goal.created_at);
                // Calculate completion date based on user setting (default 1 month if missing)
                const duration = goal.duration_months || 1;
                const endDate = new Date(createdAt);

                if (duration < 1) {
                    const d = duration === 0.25 ? 7 : duration === 0.5 ? 14 : Math.round(duration * 30);
                    endDate.setDate(endDate.getDate() + d);
                } else {
                    endDate.setMonth(endDate.getMonth() + duration);
                }

                const now = new Date();
                const isExpired = now > endDate;

                if (filterStatus === 'completed') {
                    // Show if expired (completed by time) OR explicitly marked completed
                    return isExpired || goal.is_completed === true;
                } else {
                    // Show if NOT expired AND NOT explicitly marked completed
                    return !isExpired && goal.is_completed !== true;
                }
            });
            setHistoryGoals(filtered);
        }
    };

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col pt-6 pb-32 px-5 relative overflow-hidden bg-background">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center gap-2">
                    <HistoryIcon size={24} className="text-primary" />
                    History
                </h1>
            </div>

            {/* Category Filter */}
            <div className="relative mb-6 z-10">
                {/* Status Toggle (Right Aligned, Immediately above) */}
                <div className="flex justify-end mb-2 gap-2">
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${filterStatus === 'active'
                            ? 'bg-primary text-black border-primary'
                            : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                            }`}
                    >
                        진행중인 미션
                    </button>
                    <button
                        onClick={() => setFilterStatus('completed')}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${filterStatus === 'completed'
                            ? 'bg-secondary text-white border-secondary'
                            : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                            }`}
                    >
                        완료된 미션
                    </button>
                </div>
                <div className="relative">
                    <select
                        title="카테고리 선택"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as GoalCategory)}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                    >
                        {['all', 'body_wellness', 'growth_career', 'mind_connection', 'funplay'].map(cat => {
                            let label = '';
                            let enLabel = '';
                            let count = 0;

                            if (cat === 'all') {
                                label = '전체';
                                enLabel = 'All';
                                // Sum all counts for 'All'
                                count = Object.values(missionCounts).reduce((a, b) => a + b, 0);
                            } else {
                                label = t[cat as Exclude<GoalCategory, 'all'>] || cat;
                                enLabel = cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                count = missionCounts[cat] || 0;
                            }

                            // Check if user has an active goal for this category using fresh state
                            // For 'all', we can show check if any goal is active
                            const hasGoal = cat === 'all'
                                ? Object.keys(activeGoals).length > 0
                                : activeGoals[cat];

                            return (
                                <option key={cat} value={cat} className="bg-slate-900 text-white">
                                    {hasGoal ? '✔ ' : ''}{`[${enLabel}] ${label}`} {count > 0 ? `(${count})` : ''}
                                </option>
                            );
                        })}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={24} />
                </div>
            </div>

            {/* Timeline List / Demo View */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pr-1">
                {user?.id === 'demo123' ? (
                    <div className="space-y-6">
                        {/* 1. 진행 중인 데모 미션 Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    진행 중인 데모 미션
                                </h2>
                                <span className="text-[10px] text-slate-400 font-medium">체험 모드 (4개 분야)</span>
                            </div>

                            <div className="space-y-2.5">
                                {DEMO_SAMPLE_CARDS.map((card, idx) => {
                                    const progressPercent = Math.round((card.dayCount / card.totalDays) * 100);
                                    return (
                                        <motion.div
                                            key={card.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            onClick={() => {
                                                const targetGoal = historyGoals.find(g => g.category === card.category) || historyGoals[0];
                                                setSelectedGoal(targetGoal);
                                            }}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-3.5 hover:bg-white/10 hover:border-primary/40 transition-all cursor-pointer group shadow-lg active:scale-[0.98]"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                                                        미션 {idx === 0 ? 3 : idx === 1 ? 1 : idx === 2 ? 2 : 4}: [{card.categoryName}]
                                                    </span>
                                                    <h3 className="text-sm font-bold text-white mt-1 group-hover:text-primary transition-colors">
                                                        {card.title}
                                                    </h3>
                                                </div>
                                                <span className="text-xl shrink-0 p-1 bg-white/5 rounded-xl border border-white/5">{card.icon}</span>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                                                    <span>진행도</span>
                                                    <span className="text-primary font-mono">{card.dayProgress}</span>
                                                </div>
                                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. 나의 랜덤 미션 사진 갤러리 Section (3번째 이미지 먼저 노출) */}
                        <div className="space-y-3 pt-2 border-t border-white/10">
                            <div className="flex justify-between items-center">
                                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    📸 나의 랜덤 미션 사진 갤러리
                                </h2>
                                <span className="text-[10px] text-slate-400">클릭 시 히스토리 상세</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {DEMO_SAMPLE_CARDS.map((card, idx) => (
                                    <motion.div
                                        key={`gallery-${card.id}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => {
                                            const targetGoal = historyGoals.find(g => g.category === card.category) || historyGoals[0];
                                            setSelectedGoal(targetGoal);
                                        }}
                                        className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden cursor-pointer group hover:border-primary/50 transition-all shadow-xl"
                                    >
                                        <div
                                            className="w-full h-32 bg-slate-800 relative bg-cover bg-no-repeat transition-transform duration-300 group-hover:scale-105"
                                            style={{
                                                backgroundImage: `url('/MyReDesign_히스토리 데모이미지 시안_세로.jpg')`,
                                                backgroundPosition: card.cropStyle.backgroundPosition,
                                                backgroundSize: card.cropStyle.backgroundSize
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            {idx === 0 && (
                                                <span className="absolute top-2 left-2 text-[9px] font-bold bg-accent text-black px-1.5 py-0.5 rounded shadow">
                                                    대표 샘플
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-2.5 bg-black/40">
                                            <p className="text-[11px] font-bold text-primary truncate">{card.photoLabel}</p>
                                            <p className="text-[10px] text-slate-300 truncate mt-0.5">{card.photoSubText}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : historyGoals.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <HistoryIcon size={48} className="mx-auto mb-4 text-slate-600" />
                        <p className="text-slate-400">
                            {selectedCategory === 'all'
                                ? "No history found."
                                : `No history found for ${t[selectedCategory as Exclude<GoalCategory, 'all'>]}.`}
                        </p>
                    </div>
                ) : (
                    historyGoals.map((goal, index) => {
                        const startDate = new Date(goal.created_at).toLocaleDateString();
                        const seqLabel = goal.seq ? `Challenge #${goal.seq}` : 'Challenge #1';
                        // Duration Calculations
                        const durationMonths = goal.duration_months || 1;
                        let totalDays = 0;
                        if (durationMonths < 1) {
                            totalDays = durationMonths === 0.25 ? 7 : durationMonths === 0.5 ? 14 : Math.round(durationMonths * 30);
                        } else {
                            totalDays = durationMonths * 30;
                        }

                        const diffTime = new Date().getTime() - new Date(goal.created_at).getTime();
                        const currentDay = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

                        // Multiplier: FunPlay = 1, Others = 3
                        const multiplier = goal.category === 'funplay' ? 1 : 3;

                        // Missions Expected To Date
                        const expectedMissionsToDate = currentDay * multiplier;
                        const totalExpectedMissions = totalDays * multiplier;

                        // Determine Denominator based on status
                        const endDate = new Date(goal.created_at);
                        if (durationMonths < 1) {
                            endDate.setDate(endDate.getDate() + totalDays);
                        } else {
                            endDate.setMonth(endDate.getMonth() + durationMonths);
                        }
                        const isExpired = new Date() > endDate;
                        const isEffectivelyCompleted = goal.is_completed || isExpired;

                        const displayTotal = isEffectivelyCompleted ? totalExpectedMissions : expectedMissionsToDate;
                        const displayCurrentDay = isEffectivelyCompleted ? totalDays : currentDay;

                        // Completed Count
                        const completedCount = completedCounts[`${goal.category}-${goal.seq || 1}`] || 0;
                        const categoryLabel = goal.category && t[goal.category as Exclude<GoalCategory, 'all'>] ? t[goal.category as Exclude<GoalCategory, 'all'>] : 'Mission';

                        return (
                            <motion.div
                                key={goal.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedGoal(goal)}
                                className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all cursor-pointer group active:scale-95"
                            >
                                <div className="flex justify-between items-start mb-0.5">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                {seqLabel}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-white/10 px-1.5 py-0.5 rounded-full">
                                                Day {displayCurrentDay}/{totalDays}
                                            </span>
                                            {selectedCategory === 'all' && goal.category && (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-white/10 px-1.5 py-0.5 rounded-full">
                                                    {goal.category}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                                                {goal.target_text || categoryLabel}
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                <span className="text-primary">{completedCount}</span>
                                                <span className="mx-0.5">/</span>
                                                <span>{displayTotal} 미션</span>
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-500 group-hover:text-white transition-colors w-4 h-4 mt-1 shrink-0" />
                                </div>

                                <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {startDate} ~
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            <AnimatePresence>
                {selectedGoal && (
                    <HistoryDetail
                        goal={selectedGoal}
                        onClose={() => setSelectedGoal(null)}
                        onMissionsChanged={() => {
                            fetchCompletedCounts();
                            fetchGlobalHistory();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
