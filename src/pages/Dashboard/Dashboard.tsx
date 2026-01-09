import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { generateCoaching } from '../../lib/openai';
import { Flame, Trophy, Calendar, Target, TrendingUp, Sparkles, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function Dashboard() {
    const { user } = useStore();
    const { language, t } = useLanguage();
    const [goals, setGoals] = useState<any[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | ('')>('');
    const [missions, setMissions] = useState<any[]>([]);

    // Coaching State
    const [coaching, setCoaching] = useState<{ insight: string; encouragement: string } | null>(null);
    const [coachLoading, setCoachLoading] = useState(false);

    // Chart Mode
    const [chartMode, setChartMode] = useState<'week' | 'month' | 'overall'>('week');

    useEffect(() => {
        if (user) {
            fetchGoals();
        }
    }, [user]);

    useEffect(() => {
        if (selectedGoalId) {
            fetchMissionsAndCoach();
        }
    }, [selectedGoalId]);

    const fetchGoals = async () => {
        const { data } = await supabase.from('user_goals').select('*').eq('user_id', user!.id);
        if (data && data.length > 0) {
            setGoals(data);
            setSelectedGoalId(data[0].id);
        }
    };

    const fetchMissionsAndCoach = async () => {
        const { data } = await supabase
            .from('missions')
            .select('*')
            .eq('user_id', user!.id)
            .order('date', { ascending: true }); // Get all history

        if (data) {
            // Filter by goal category
            const goal = goals.find(g => g.id === selectedGoalId);
            if (goal) {
                const goalMissions = data.filter(m => m.category === goal.category);
                setMissions(goalMissions);

                // Trigger AI Coach analysis
                generateCoachInsight(goal, goalMissions);
            }
        }
    };

    // --- Date Helpers ---
    const toYMD = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const calculateStreak = (ms: any[]) => {
        // Sort by date desc
        const sorted = [...ms].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        let streak = 0;
        // Group by date to handle multiple missions per day
        const byDate: Record<string, boolean> = {};
        sorted.forEach(m => {
            if (m.is_completed) byDate[m.date] = true;
        });

        const today = new Date();
        // Check backwards
        for (let i = 0; i < 365; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const ymd = toYMD(d);

            if (byDate[ymd]) {
                streak++;
            } else {
                // If today is empty, don't break streak immediately only if i==0
                // (Allow streak to persist even if today is not done YET)
                if (i === 0) continue;
                break;
            }
        }
        return streak;
    };

    const generateCoachInsight = async (goal: any, goalMissions: any[]) => {
        setCoachLoading(true);
        // Calculate basic stats for prompt
        const total = goalMissions.length;
        const completed = goalMissions.filter(m => m.is_completed).length;
        const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const streak = calculateStreak(goalMissions);

        const recentHistory = goalMissions.slice(-5).map(m => ({ date: m.date, completed: m.is_completed }));

        // Check local storage / cache to avoid spamming API
        const cacheKey = `coach_${goal.id}_${toYMD(new Date())}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            setCoaching(JSON.parse(cached));
        } else {
            const insightData = await generateCoaching(user, goal, { total, successRate, streak, recentHistory }, language);
            setCoaching(insightData);
            localStorage.setItem(cacheKey, JSON.stringify(insightData));
        }
        setCoachLoading(false);
    };

    const selectedGoal = goals.find(g => g.id === selectedGoalId);

    // --- Stats Calculation ---
    const stats = useMemo(() => {
        if (!selectedGoal) return { total: 0, completed: 0, rate: 0, streak: 0, daysRunning: 0 };

        const total = missions.length;
        const completed = missions.filter(m => m.is_completed).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const streak = calculateStreak(missions);

        const start = new Date(selectedGoal.created_at);
        const now = new Date();
        const diff = now.getTime() - start.getTime();
        const daysRunning = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);

        return { total, completed, rate, streak, daysRunning };
    }, [missions, selectedGoal]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        const data = [];
        const today = new Date();

        if (chartMode === 'week') {
            // Last 7 Days: Fri, Thu, Wed...
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const ymd = toYMD(d);

                const dayMissions = missions.filter(m => m.date === ymd);
                const dayTotal = dayMissions.length;
                const dayCompleted = dayMissions.filter(m => m.is_completed).length;

                // Show 100% if no missions? No, 0%
                const val = dayTotal > 0 ? (dayCompleted / dayTotal) * 100 : 0;

                // Label
                const label = i === 0 ? 'Today' : dayNames[d.getDay()];

                data.push({ label, value: val, date: ymd });
            }
        } else if (chartMode === 'month') {
            // Last 4 Weeks (grouped)
            // Start from beginning of this week (Sunday or Monday?)
            // Let's just do last 28 days grouped by 7
            for (let i = 3; i >= 0; i--) {
                const end = new Date();
                end.setDate(today.getDate() - (i * 7));
                const start = new Date(end);
                start.setDate(end.getDate() - 6);

                // Collect missions in this range
                let rangeTotal = 0;
                let rangeCompleted = 0;

                // Iterate days in this week
                let current = new Date(start);
                while (current <= end) {
                    const ymd = toYMD(current);
                    const daysMissions = missions.filter(m => m.date === ymd);
                    rangeTotal += daysMissions.length;
                    rangeCompleted += daysMissions.filter(m => m.is_completed).length;
                    current.setDate(current.getDate() + 1);
                }

                const val = rangeTotal > 0 ? (rangeCompleted / rangeTotal) * 100 : 0;
                data.push({
                    label: i === 0 ? 'This Week' : `${i}w ago`,
                    value: val
                });
            }
        } else {
            // Overall: Last 6 Months
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(today.getMonth() - i);
                const monthKey = d.getMonth(); // 0-11
                const monthYear = d.getFullYear();

                // Filter missions for this month
                const monthMissions = missions.filter(m => {
                    const md = new Date(m.date);
                    return md.getMonth() === monthKey && md.getFullYear() === monthYear;
                });

                const total = monthMissions.length;
                const completed = monthMissions.filter(m => m.is_completed).length;
                const val = total > 0 ? (completed / total) * 100 : 0;

                const monthName = d.toLocaleString('default', { month: 'short' });
                data.push({ label: monthName, value: val });
            }
        }
        return data;
    }, [missions, chartMode]);


    return (
        <div className="w-full max-w-md mx-auto h-[calc(100dvh-5rem)] overflow-y-auto pb-24 no-scrollbar pt-6 px-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                    {t.growth}
                </h1>
                <div className="bg-white/5 p-2 rounded-full">
                    <TrendingUp size={20} className="text-accent" />
                </div>
            </div>
            {/* Header: Goal Selector */}
            <div className="mb-6">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">{t.analysisTarget}</label>
                <div className="relative">
                    <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                    >
                        {goals.map(g => (
                            <option key={g.id} value={g.id} className="bg-slate-800 text-white">
                                {g.target_text ? `[${g.category.toUpperCase()}] ${g.target_text}` : g.category.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={20} />
                    </div>
                </div>

                {selectedGoal && (
                    <div className="mt-3 flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <Calendar size={14} />
                            {t.started} {new Date(selectedGoal.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-primary text-xs font-bold bg-primary/10 px-3 py-1 rounded-full">
                            <TrendingUp size={14} />
                            {t.day} {stats.daysRunning}
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center border border-white/5">
                    <Target className="text-primary mb-2" size={24} />
                    <span className="text-xl font-bold text-white">{missions.length}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{t.totalMissions}</span>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center border border-white/5">
                    <Trophy className="text-yellow-500 mb-2" size={24} />
                    <span className="text-xl font-bold text-white">
                        {missions.length > 0 ? Math.round((missions.filter(m => m.is_completed).length / missions.length) * 100) : 0}%
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{t.successRate}</span>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center border border-white/5">
                    <Flame className="text-orange-500 mb-2" size={24} />
                    <span className="text-xl font-bold text-white">{calculateStreak(missions)}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{t.currentStreak}</span>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 mb-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Target size={16} className="text-primary" />
                        {t.performanceTrend}
                    </h3>
                    <div className="flex bg-black/40 rounded-lg p-0.5">
                        <button
                            onClick={() => setChartMode('week')}
                            className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all ${chartMode === 'week' ? 'bg-primary text-black shadow-md' : 'text-slate-500 hover:text-white'}`}
                        >
                            {t.week}
                        </button>
                        <button
                            onClick={() => setChartMode('month')}
                            className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all ${chartMode === 'month' ? 'bg-primary text-black shadow-md' : 'text-slate-500 hover:text-white'}`}
                        >
                            {t.month_label}
                        </button>
                        <button
                            onClick={() => setChartMode('overall')}
                            className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all ${chartMode === 'overall' ? 'bg-primary text-black shadow-md' : 'text-slate-500 hover:text-white'}`}
                        >
                            {t.overall}
                        </button>
                    </div>
                </div>

                {/* Graph */}
                <div className="h-40 flex items-end justify-between gap-2 relative z-10 pl-2">
                    {/* Y-Axis Guidelines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                        <div className="border-t border-dashed border-white w-full"></div>
                        <div className="border-t border-dashed border-white w-full"></div>
                        <div className="border-t border-dashed border-white w-full"></div>
                    </div>

                    {chartData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                            <div className="w-full relative flex items-end justify-center h-full">
                                <div
                                    className={`w-full max-w-[24px] rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-110 ${d.value > 0
                                        ? 'bg-gradient-to-t from-violet-600 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                                        : 'bg-white/5'
                                        }`}
                                    style={{ height: `${d.value || 5}%` }}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-lg">
                                        {Math.round(d.value)}%
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Coach Insight */}
            <div className="relative p-[1px] rounded-3xl bg-gradient-to-br from-green-400/50 via-emerald-500/20 to-transparent">
                <div className="bg-slate-900 rounded-[23px] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[50px] rounded-full pointer-events-none"></div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">AI Coach Insight</h3>
                            <p className="text-[10px] text-slate-400">Personalized Analysis</p>
                        </div>
                    </div>

                    {coachLoading ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                            <div className="h-4 bg-white/5 rounded w-1/2"></div>
                        </div>
                    ) : coaching ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-200 leading-relaxed font-light">
                                "{coaching.insight}"
                            </p>
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-sm font-bold text-green-400 flex items-center gap-2">
                                    <Trophy size={14} />
                                    {coaching.encouragement}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Select a goal to get AI coaching.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
