import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';
import { ChevronDown, Calendar, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HistoryDetail from './HistoryDetail';

type GoalCategory = 'health' | 'growth' | 'mindset' | 'career' | 'social' | 'vitality';

export default function History() {
    const { user } = useStore();
    const { t } = useLanguage();
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('health');
    const [historyGoals, setHistoryGoals] = useState<any[]>([]);
    const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
    const [missionCounts, setMissionCounts] = useState<Record<string, number>>({});
    const [activeGoals, setActiveGoals] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (user) {
            fetchMissionCounts();
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

            // Auto-select the first active category if one exists
            const categories: GoalCategory[] = ['health', 'growth', 'mindset', 'career', 'social', 'vitality'];
            const firstActive = categories.find(cat => active[cat]);

            if (firstActive) {
                setSelectedCategory(firstActive);
            }
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

    useEffect(() => {
        if (user) fetchGlobalHistory();
    }, [user, selectedCategory]);

    const fetchGlobalHistory = async () => {
        // Fetch ALL goals for this category, ordered by seq descending (latest first)
        const { data } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user!.id)
            .eq('category', selectedCategory)
            .order('seq', { ascending: false });

        if (data) setHistoryGoals(data);
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
            <div className="relative mb-8 z-10">
                <div className="relative">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as GoalCategory)}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                    >
                        {['health', 'growth', 'mindset', 'career', 'social', 'vitality'].map(cat => {
                            const count = missionCounts[cat] || 0;
                            const label = t[cat as GoalCategory];
                            const enLabel = cat.charAt(0).toUpperCase() + cat.slice(1);

                            // Check if user has an active goal for this category using fresh state
                            const hasGoal = activeGoals[cat];

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
                        <p className="text-slate-400">No history found for {t[selectedCategory]}.</p>
                    </div>
                ) : (
                    historyGoals.map((goal, index) => {
                        // isCurrent logic removed as unused
                        const startDate = new Date(goal.created_at).toLocaleDateString();
                        const seqLabel = goal.seq ? `Challenge #${goal.seq}` : 'Challenge #1';

                        return (
                            <motion.div
                                key={goal.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedGoal(goal)}
                                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group active:scale-95"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                                                {seqLabel}
                                            </span>
                                            {/* Status Badge (Placeholder logic) */}
                                            {/* We ideally need a status column, but we can infer or just show date */}
                                        </div>
                                        <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                                            {goal.target_text || t[selectedCategory]}
                                        </h3>
                                    </div>
                                    <ChevronRight className="text-slate-500 group-hover:text-white transition-colors" />
                                </div>

                                <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        {startDate} ~
                                    </span>
                                    {/* Ideally we fetch completion rate here too, but maybe lazy load in detail? */}
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
