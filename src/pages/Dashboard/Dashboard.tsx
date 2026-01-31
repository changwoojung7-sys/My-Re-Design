import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { generateCoaching } from '../../lib/openai';
import { Flame, Trophy, Calendar, Target, TrendingUp, Sparkles, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function Dashboard() {
    const { user } = useStore();
    const { language, t } = useLanguage();
    const [goals, setGoals] = useState<any[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | ('')>('');
    const [missions, setMissions] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed'>('active');

    // Coaching State
    const [coaching, setCoaching] = useState<{ insight: string; encouragement: string } | null>(null);
    const [coachLoading, setCoachLoading] = useState(false);

    // Chart Mode
    const [chartMode, setChartMode] = useState<'week' | 'month' | 'overall'>('week');
    // For Month/Overall View Navigation
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        if (user) {
            fetchGoals();
        }
    }, [user]);

    const fetchGoals = async () => {
        // Fetch ALL goals first
        const { data } = await supabase.from('user_goals').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
        if (data) {
            setGoals(data);
        }
    };

    // Filter Logic (Same as History.tsx)
    const filteredGoals = useMemo(() => {
        return goals.filter((goal: any) => {
            const createdAt = new Date(goal.created_at);
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
                return isExpired || goal.is_completed === true;
            } else {
                return !isExpired && goal.is_completed !== true;
            }
        });
    }, [goals, filterStatus]);

    // Auto-select first goal when list changes
    useEffect(() => {
        if (filteredGoals.length > 0) {
            if (!filteredGoals.find(g => g.id === selectedGoalId)) {
                setSelectedGoalId(filteredGoals[0].id);
            }
        } else {
            setSelectedGoalId('');
        }
    }, [filteredGoals, selectedGoalId]);

    useEffect(() => {
        if (selectedGoalId) {
            fetchMissionsAndCoach();
        }
    }, [selectedGoalId]);

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
                const goalSeq = goal.seq || 1;
                const goalMissions = data.filter(m =>
                    m.category === goal.category &&
                    (m.seq === goalSeq || (!m.seq && goalSeq === 1))
                );
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
        const cacheKey = `coach_${goal.id}_${goal.seq || 1}_${toYMD(new Date())}`;
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


    // --- Calendar / Year Data Helpers ---

    // Change Month/Year
    const navigateView = (direction: 'prev' | 'next') => {
        const newDate = new Date(viewDate);
        if (chartMode === 'month') {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else {
            newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
        }
        setViewDate(newDate);
    };

    // Get Calendar Days for Month View
    const getCalendarDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        // Pad start (M T W T F S S vs S M T W T F S) - Standard JS uses Sunday=0
        const startPad = firstDay.getDay(); // 0 is Sunday

        for (let i = 0; i < startPad; i++) days.push(null); // Empty slots

        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d));
        }
        return days;
    };

    // Get Year Months Data
    const getYearMonths = () => {
        const year = viewDate.getFullYear();
        const months = [];

        for (let m = 0; m < 12; m++) {
            const date = new Date(year, m, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });

            // Stats for this month
            const monthMissions = missions.filter(ms => {
                const d = new Date(ms.date);
                return d.getFullYear() === year && d.getMonth() === m;
            });
            const total = monthMissions.length;
            const completed = monthMissions.filter(ms => ms.is_completed).length;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

            months.push({ name: monthName, total, completed, percentage });
        }
        return months;
    };

    // --- Chart Data Preparation (Only for Week mode effectively now) ---
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
                const val = dayTotal > 0 ? (dayCompleted / dayTotal) * 100 : 0;

                // Label
                const label = i === 0 ? 'Today' : dayNames[d.getDay()];

                data.push({ label, value: val, date: ymd });
            }
        }
        // Month/Year modes handled by direct render helpers now
        return data;
    }, [missions, chartMode]);


    return (
        <div className="w-full max-w-md mx-auto h-[calc(100dvh-5rem)] flex flex-col pt-6 px-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent flex items-center gap-2">
                    <TrendingUp size={24} className="text-accent" />
                    Growth
                </h1>
            </div>

            {/* Header: Goal Selector */}
            <div className="mb-2 shrink-0">
                <div className="flex justify-between items-end mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.analysisTarget}</label>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setFilterStatus('active')}
                            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${filterStatus === 'active'
                                ? 'bg-primary text-black border-primary'
                                : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                }`}
                        >
                            {t.inProgress || 'Active'}
                        </button>
                        <button
                            onClick={() => setFilterStatus('completed')}
                            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${filterStatus === 'completed'
                                ? 'bg-secondary text-white border-secondary'
                                : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                }`}
                        >
                            {t.complete || 'Completed'}
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                    >
                        {filteredGoals.length > 0 ? (
                            filteredGoals.map(g => {
                                const enLabel = g.category.charAt(0).toUpperCase() + g.category.slice(1);
                                const koLabel = t[g.category as keyof typeof t] || g.category;
                                return (
                                    <option key={g.id} value={g.id} className="bg-slate-800 text-white">
                                        {`✔ [${enLabel}] ${koLabel}`} {g.target_text ? `- ${g.target_text}` : ''}
                                        {g.seq && g.seq > 1 ? ` (${t.challengeCount.replace('{n}', g.seq)})` : ''}
                                    </option>
                                );
                            })
                        ) : (
                            <option value="" className="bg-slate-800 text-slate-500 italic">No {filterStatus} goals</option>
                        )}
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-32 min-h-0 pt-2">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white/5 rounded-2xl py-3 px-3 flex items-center justify-center gap-3 border border-white/5 shadow-sm">
                        <Target className="text-primary shrink-0" size={20} />
                        <div className="flex flex-col items-start min-w-[30px]">
                            <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{t.totalMissions}</span>
                            <span className="text-lg font-bold text-white leading-none">{missions.length}</span>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl py-3 px-3 flex items-center justify-center gap-3 border border-white/5 shadow-sm">
                        <Trophy className="text-yellow-500 shrink-0" size={20} />
                        <div className="flex flex-col items-start min-w-[30px]">
                            <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{t.successRate}</span>
                            <span className="text-lg font-bold text-white leading-none">
                                {missions.length > 0 ? Math.round((missions.filter(m => m.is_completed).length / missions.length) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl py-3 px-3 flex items-center justify-center gap-3 border border-white/5 shadow-sm">
                        <Flame className="text-orange-500 shrink-0" size={20} />
                        <div className="flex flex-col items-start min-w-[30px]">
                            <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{t.currentStreak}</span>
                            <span className="text-lg font-bold text-white leading-none">{calculateStreak(missions)}</span>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className={`bg-slate-900/50 p-4 rounded-3xl border border-white/5 mb-4 shadow-xl relative overflow-hidden transition-all ${chartMode !== 'week' ? 'min-h-[340px]' : ''}`}>
                    <div className="flex justify-between items-center mb-4 relative z-10">
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

                    {/* VISUALIZATION CONTENT */}

                    {/* 1. WEEKLY CHART */}
                    {chartMode === 'week' && (
                        <div className="h-32 flex items-end justify-between gap-2 relative z-10 pl-2">
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
                    )}

                    {/* 2. MONTHLY CALENDAR */}
                    {chartMode === 'month' && (
                        <div className="animate-in fade-in duration-300">
                            {/* Nav */}
                            <div className="flex items-center justify-between mb-4 px-2">
                                <button onClick={() => navigateView('prev')} className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm font-bold text-white uppercase tracking-wider">
                                    {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => navigateView('next')} className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                    <span key={d} className="text-[10px] text-slate-500 font-bold">{d}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                                {getCalendarDays().map((date, i) => {
                                    if (!date) return <div key={i} />;

                                    const ymd = toYMD(date);
                                    const dayMissions = missions.filter(m => m.date === ymd);
                                    const isDone = dayMissions.some(m => m.is_completed);
                                    const isToday = ymd === toYMD(new Date());

                                    return (
                                        <div key={i} className={`
                                            aspect-square rounded-full flex items-center justify-center text-xs font-medium relative
                                            ${isDone ? 'bg-gradient-to-br from-green-400 to-green-600 text-black shadow-lg shadow-green-500/20' :
                                                isToday ? 'bg-white/10 text-white border border-primary' : 'text-slate-500 hover:bg-white/5'}
                                        `}>
                                            {date.getDate()}
                                            {isDone && <CheckCircle2 size={10} className="absolute -bottom-1 -right-1 text-white bg-black rounded-full" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary Footer */}
                            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[10px] text-slate-400 px-2">
                                <span>
                                    {t.month_label} Total: <strong className="text-white">{missions.filter(m => {
                                        const d = new Date(m.date);
                                        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                                    }).length}</strong>
                                </span>
                                <span>
                                    Success: <strong className="text-green-400">{missions.filter(m => {
                                        const d = new Date(m.date);
                                        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear() && m.is_completed;
                                    }).length}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 3. YEARLY GRID */}
                    {chartMode === 'overall' && (
                        <div className="animate-in fade-in duration-300">
                            {/* Nav */}
                            <div className="flex items-center justify-between mb-4 px-2">
                                <button onClick={() => navigateView('prev')} className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm font-bold text-white uppercase tracking-wider">
                                    {viewDate.getFullYear()}
                                </span>
                                <button onClick={() => navigateView('next')} className="p-1 hover:bg-white/10 rounded-full text-slate-400">
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {getYearMonths().map((m, i) => (
                                    <div key={i} className={`bg-white/5 rounded-xl p-2 flex flex-col items-center justify-center border border-white/5
                                        ${m.percentage === 100 ? 'border-green-500/30 bg-green-500/5' : ''}
                                    `}>
                                        <span className="text-xs font-bold text-slate-300 mb-1">{m.name}</span>
                                        <div className="relative w-10 h-10 flex items-center justify-center">
                                            {/* Circular Progress (CSS conic gradient) */}
                                            <div
                                                className="absolute inset-0 rounded-full"
                                                style={{ background: `conic-gradient(var(--color-primary, #a855f7) ${m.percentage}%, transparent 0)` }}
                                            />
                                            <div className="absolute inset-1 bg-slate-900 rounded-full" />
                                            <span className="relative text-[10px] font-bold text-white">{m.percentage}%</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 mt-1">{m.completed}/{m.total}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Coach Insight */}
                    <div className="relative p-[1px] rounded-3xl bg-gradient-to-br from-green-400/50 via-emerald-500/20 to-transparent">
                        <div className="bg-slate-900 rounded-[23px] p-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[50px] rounded-full pointer-events-none"></div>

                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">AI Coach Insight</h3>
                                    <p className="text-[10px] text-slate-400">Personalized Analysis</p>
                                </div>
                            </div>

                            {coachLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                                    <div className="h-4 bg-white/5 rounded w-1/2"></div>
                                </div>
                            ) : coaching ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-200 leading-relaxed font-light">
                                        "{coaching.insight}"
                                    </p>
                                    <div className="pt-3 border-t border-white/5">
                                        <p className="text-xs font-bold text-green-400 flex items-center gap-2">
                                            <Trophy size={12} />
                                            {coaching.encouragement}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Select a goal to get AI coaching.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
