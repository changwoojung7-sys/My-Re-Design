import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';
import { ChevronDown, Calendar, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HistoryDetail from './HistoryDetail';

type GoalCategory = 'all' | 'health' | 'growth' | 'mindset' | 'career' | 'social' | 'vitality';

export default function History() {
    const { user } = useStore();
    const { t } = useLanguage();
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
            const filtered = data.filter(goal => {
                const createdAt = new Date(goal.created_at);
                // Calculate completion date based on user setting (default 1 month if missing)
                const duration = goal.duration_months || 1;
                const endDate = new Date(createdAt);
                endDate.setMonth(endDate.getMonth() + duration);

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
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as GoalCategory)}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                    >
                        {['all', 'health', 'growth', 'mindset', 'career', 'social', 'vitality'].map(cat => {
                            let label = '';
                            let enLabel = '';
                            let count = 0;

                            if (cat === 'all') {
                                label = '전체';
                                enLabel = 'All';
                                // Sum all counts for 'All'
                                count = Object.values(missionCounts).reduce((a, b) => a + b, 0);
                            } else {
                                label = t[cat as Exclude<GoalCategory, 'all'>];
                                enLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
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

            {/* Timeline List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
                {historyGoals.length === 0 ? (
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
                        const totalDays = durationMonths * 30;

                        const diffTime = new Date().getTime() - new Date(goal.created_at).getTime();
                        const currentDay = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

                        // Missions Expected To Date (3 per day)
                        const expectedMissionsToDate = currentDay * 3;
                        const totalExpectedMissions = totalDays * 3;

                        // Determine Denominator based on status
                        // If it's completed or expired, show Total Expected for the whole duration.
                        // If it's active, show Expected To Date.
                        const endDate = new Date(goal.created_at);
                        endDate.setMonth(endDate.getMonth() + durationMonths);
                        const isExpired = new Date() > endDate;
                        const isEffectivelyCompleted = goal.is_completed || isExpired;

                        const displayTotal = isEffectivelyCompleted ? totalExpectedMissions : expectedMissionsToDate;

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
                                                Day {currentDay}/{totalDays}
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
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
