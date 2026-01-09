import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../lib/store';
import { generateMissions } from '../../lib/openai';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Flame, Sparkles, Camera, PenTool, Mic, Video, X, ListTodo } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../../lib/i18n';

export default function Today() {
    const { user, missions, setMissions } = useStore();
    const { language, t } = useLanguage();
    const [loading, setLoading] = useState(false);

    // Upload/Verify State
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [verifyMode, setVerifyMode] = useState<'media' | 'text'>('media');
    const [textInput, setTextInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helpers: Consistent Local Date String
    const formatLocalYMD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // New State
    // Default to Today in local time
    const [selectedDate, setSelectedDate] = useState<string>(formatLocalYMD(new Date()));

    const [userGoals, setUserGoals] = useState<any[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [draftMissions, setDraftMissions] = useState<any[]>([]);
    const [refreshCount, setRefreshCount] = useState(0);

    // Derived State
    const selectedGoal = userGoals.find(g => g.id === selectedGoalId);

    // Initial Fetch
    useEffect(() => {
        if (user) initData();
    }, [user]);

    // Rerun fetch when Date or Goal changes
    useEffect(() => {
        if (user && selectedGoalId) {
            // Load refresh count from local storage
            const key = `refresh_${user.id}_${selectedGoalId}_${selectedDate}`;
            const saved = localStorage.getItem(key);
            setRefreshCount(saved ? parseInt(saved) : 0);

            fetchMissions();
        }
    }, [selectedDate, selectedGoalId]);

    const initData = async () => {
        setLoading(true);
        const { data: goals } = await supabase.from('user_goals').select('*').eq('user_id', user!.id);
        if (goals && goals.length > 0) {
            setUserGoals(goals);
            setSelectedGoalId(goals[0].id);
        }
        setLoading(false);
    };

    const fetchMissions = async () => {
        if (!selectedGoalId) return;
        setLoading(true);
        setDraftMissions([]);
        setVerifyingId(null); // Clear any active verification

        // Note: 'date' column in DB is likely type DATE or TEXT (YYYY-MM-DD). 
        // Passing the local YYYY-MM-DD string is correct for matching.
        const { data: existing } = await supabase
            .from('missions')
            .select('*')
            .eq('user_id', user!.id)
            .eq('date', selectedDate)
            .order('created_at');

        // Filter by category client-side to ensure match
        const goalCategory = selectedGoal?.category.toLowerCase();
        const relevantMissions = existing?.filter(m => m.category.toLowerCase() === goalCategory) || [];

        if (relevantMissions.length > 0) {
            setMissions(relevantMissions.slice(0, 3)); // Strict Limit 3
        } else {
            setMissions([]);
            // Logic for Draft Generation:
            const today = formatLocalYMD(new Date());
            // Allow generation if selected date is Today or Future
            if (selectedDate >= today) {
                await generateDraftPlan();
            }
        }
        setLoading(false);
    };

    const generateDraftPlan = async () => {
        // Generate via AI
        const newMissions = await generateMissions(user, language);

        // Filter for CURRENT selected category
        const currentCategoryMissions = newMissions.filter(m => m.category.toLowerCase() === selectedGoal?.category.toLowerCase());
        const finalDrafts = currentCategoryMissions.slice(0, 3);

        const mapped = finalDrafts.map((m, i) => ({
            id: `draft-${i}`,
            user_id: user!.id,
            content: m.content,
            category: m.category,
            verification_type: m.verification_type || 'image', // Capture AI suggestion
            date: selectedDate,
            is_completed: false
        }));
        setDraftMissions(mapped);
    };

    const handleRefresh = async () => {
        if (refreshCount >= 3) return;
        setLoading(true);
        await generateDraftPlan();

        const newCount = refreshCount + 1;
        setRefreshCount(newCount);
        const key = `refresh_${user!.id}_${selectedGoalId}_${selectedDate}`;
        localStorage.setItem(key, newCount.toString());
        setLoading(false);
    };

    const confirmPlan = async () => {
        setLoading(true);
        const missionsToInsert = draftMissions.map(({ id, ...rest }) => rest);
        const { data, error } = await supabase.from('missions').insert(missionsToInsert).select();
        if (!error && data) {
            setMissions(data);
            setDraftMissions([]);
        }
        setLoading(false);
    };

    // --- Verification Logic ---

    const openVerify = (mission: any) => {
        if (verifyingId === mission.id) {
            setVerifyingId(null); // Toggle off
        } else {
            setVerifyingId(mission.id);
            // Default mode based on mission type
            setVerifyMode(mission.verification_type === 'text' ? 'text' : 'media');
            setTextInput('');
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !verifyingId) return;

        try {
            const fileName = `${user!.id}/${verifyingId}_${Date.now()}`;
            const { error } = await supabase.storage.from('mission-proofs').upload(fileName, file);
            if (error) throw error;
            const publicUrl = supabase.storage.from('mission-proofs').getPublicUrl(fileName).data.publicUrl;

            // Determine type
            let type = 'image';
            if (file.type.startsWith('video')) type = 'video';
            if (file.type.startsWith('audio')) type = 'audio';

            await supabase.from('missions').update({
                is_completed: true,
                image_url: publicUrl, // Storing Media URL here
                proof_type: type
            }).eq('id', verifyingId);

            const updated = missions.map(m => m.id === verifyingId ? { ...m, is_completed: true, image_url: publicUrl, proof_type: type } : m);
            setMissions(updated);
            setVerifyingId(null); // Close verification area on success
            triggerConfetti();
        } catch (err) {
            // @ts-ignore
            alert(`Upload failed: ${err.message}`);
        }
    };

    const handleTextSubmit = async () => {
        if (!textInput.trim() || !verifyingId) return;

        try {
            await supabase.from('missions').update({
                is_completed: true,
                proof_text: textInput,
                proof_type: 'text'
            }).eq('id', verifyingId);

            const updated = missions.map(m => m.id === verifyingId ? { ...m, is_completed: true, proof_text: textInput, proof_type: 'text' } : m);
            setMissions(updated);
            setVerifyingId(null); // Close verification area on success
            triggerConfetti();
        } catch (err) {
            console.error(err);
            alert('Failed to save text.');
        }
    };

    const triggerFileClick = () => fileInputRef.current?.click();

    const triggerConfetti = () => {
        confetti({ particleCount: 150, spread: 80, colors: ['#8b5cf6', '#ec4899', '#ffffff'] });
    };

    // --- Date Helpers ---
    const getDateOptions = () => {
        if (!selectedGoal) return [];
        const start = new Date(selectedGoal.created_at);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const list = [];
        let current = new Date(start);
        let count = 0;
        while (current.getTime() <= tomorrow.getTime() && count < 365) {
            const val = formatLocalYMD(current);
            const diffMs = current.getTime() - start.getTime();
            const dayNum = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

            let label = `${t.day} ${dayNum}`;
            if (current.getTime() === today.getTime()) label += ` (${t.today})`;
            else if (current.getTime() === tomorrow.getTime()) label += ` (${t.tomorrow})`;
            else label += ` (${current.getMonth() + 1}/${current.getDate()})`;

            list.push({ value: val, label });
            current.setDate(current.getDate() + 1);
            count++;
        }
        return list.reverse();
    };

    const dateOptions = getDateOptions();

    const getSelectedDayNum = () => {
        if (!selectedGoal) return 1;
        const start = new Date(selectedGoal.created_at);
        start.setHours(0, 0, 0, 0);
        const [y, m, d] = selectedDate.split('-').map(Number);
        const current = new Date(y, m - 1, d);
        const diffMs = current.getTime() - start.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    };

    const isPreview = missions.length === 0 && draftMissions.length > 0;
    const isPastEmpty = missions.length === 0 && draftMissions.length === 0 && selectedDate < formatLocalYMD(new Date());
    const activeList = isPreview ? draftMissions : missions;

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col pt-6 pb-20">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
            />

            {/* Header Area (Fixed) */}
            <div className="px-5 shrink-0">
                {/* Apps Title */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                        {t.missions}
                    </h1>
                    <div className="bg-white/5 p-2 rounded-full">
                        <ListTodo size={20} className="text-accent" />
                    </div>
                </div>

                <div className="flex justify-between items-end mb-2 px-1">
                    <div>
                        {selectedGoal?.created_at && (
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                                Started {new Date(selectedGoal.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-primary font-bold tracking-wide uppercase">
                            {new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </p>
                    </div>
                </div>

                {userGoals.length > 0 ? (
                    <div className="relative">
                        <select
                            value={selectedGoalId || ''}
                            onChange={(e) => setSelectedGoalId(e.target.value)}
                            className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                        >
                            {userGoals.map(g => (
                                <option key={g.id} value={g.id} className="bg-slate-800 text-white">
                                    {g.target_text ? `[${g.category.toUpperCase()}] ${g.target_text}` : g.category.toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                    </div>
                ) : (
                    <h1 className="text-2xl font-bold text-white mb-2 text-center">Today's Loop</h1>
                )}
            </div>

            {/* Streak/Goal Info */}
            {selectedGoal && (
                <div className="mb-6 shrink-0 grid grid-cols-2 gap-3 px-5">
                    <div className="relative bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center justify-center gap-3 overflow-hidden">
                        <div className="absolute inset-0 opacity-0">
                            <select
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full h-full cursor-pointer bg-slate-800 text-white"
                            >
                                {dateOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="p-1.5 bg-primary/20 rounded-full text-primary pointer-events-none"><Flame size={18} /></div>
                        <div className="text-left pointer-events-none">
                            <span className="block text-[10px] text-slate-400 uppercase font-bold">{t.inProgress}</span>
                            <div className="flex items-center gap-1">
                                <span className="block text-sm font-bold text-white">Day {getSelectedDayNum()}</span>
                                <span className="text-[10px] text-slate-500">▼</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center justify-center gap-3">
                        <div className="p-1.5 bg-accent/20 rounded-full text-accent"><CheckCircle size={18} /></div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-1">
                                {t.missionOverview}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{t.day} {getSelectedDayNum()} / {selectedGoal?.duration_months} {selectedGoal?.duration_months > 1 ? t.months : t.month}</span>
                                <span>•</span>
                                <span>{missions.filter(m => m.is_completed).length}/{missions.length} {t.complete}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW BANNER */}
            {isPreview && (
                <div className="mb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 px-5 shrink-0">
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <Sparkles size={20} className="text-primary animate-pulse" />
                            <div>
                                <p className="text-sm font-bold text-white">New Mission Proposal</p>
                                <p className="text-[10px] text-slate-400">Review carefully before accepting</p>
                            </div>
                        </div>
                        <button
                            onClick={confirmPlan}
                            className="bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                        >
                            Confirm & Start
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshCount >= 3 || loading}
                            className="text-[10px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Change Missions ({3 - refreshCount} left) ↻
                        </button>
                    </div>
                </div>
            )}

            {isPastEmpty && (
                <div className="mb-4 p-4 text-center rounded-xl border border-dashed border-slate-700 mx-5 shrink-0">
                    <p className="text-slate-500 text-sm">No record for this day.</p>
                </div>
            )}

            {/* Mission List (Scrollable) */}
            <div className="space-y-4 flex-1 overflow-y-auto min-h-0 px-5 pb-4 custom-scrollbar">
                {loading ? (
                    <div className="text-center py-10 animate-pulse mt-10">
                        <Sparkles className="mx-auto mb-3 text-primary" size={28} />
                        <p className="text-sm text-slate-400 font-medium">Designing your loop...</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {activeList.map((mission) => {
                            const isBeingVerified = verifyingId === mission.id;

                            return (
                                <motion.div
                                    key={mission.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`relative rounded-2xl border transition-all shadow-md overflow-hidden ${isPreview ? 'bg-white/5 border-dashed border-slate-600 opacity-90 p-4' :
                                        mission.is_completed ? 'bg-slate-900/40 border-slate-800/50 p-4' : 'bg-gradient-to-br from-white/10 to-white/5 border-white/10'
                                        }`}
                                >
                                    {/* Main Card Content */}
                                    <div className={`${!isPreview && !mission.is_completed && !isBeingVerified ? 'p-4' : ''}`}>
                                        <div className="flex items-start gap-4">
                                            {/* Check Icon */}
                                            <button
                                                onClick={() => !isPreview && !mission.is_completed && openVerify(mission)}
                                                disabled={isPreview}
                                                className={`mt-1 shrink-0 transition-all ${isPreview ? 'text-slate-600 cursor-default' :
                                                    mission.is_completed ? 'text-green-500' : 'text-slate-500 hover:text-white'
                                                    }`}
                                            >
                                                {mission.is_completed ? <CheckCircle size={26} /> : <Circle size={26} />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                {/* Header Row */}
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                                                        {mission.category}
                                                    </span>

                                                    {/* Action Button (Verify/Check) */}
                                                    {!isPreview && !mission.is_completed && !isBeingVerified && (
                                                        <div
                                                            onClick={() => openVerify(mission)}
                                                            className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer hover:text-primary transition-colors bg-black/20 px-2 py-1 rounded-lg"
                                                        >
                                                            {mission.verification_type === 'text' ? <PenTool size={14} /> : <Camera size={14} />}
                                                            <span>Verify</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <h3 className={`text-base font-medium leading-snug ${mission.is_completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                    {mission.content}
                                                </h3>

                                                {/* COMPLETED PROOF DISPLAY */}
                                                {mission.is_completed && (
                                                    <div className="mt-3">
                                                        {mission.proof_type === 'text' ? (
                                                            <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 text-sm text-slate-300 italic">
                                                                " {mission.proof_text} "
                                                            </div>
                                                        ) : mission.proof_type === 'video' ? (
                                                            <video src={mission.image_url} controls className="w-full h-32 object-cover rounded-xl border border-white/10" />
                                                        ) : mission.proof_type === 'audio' ? (
                                                            <audio src={mission.image_url} controls className="w-full mt-2" />
                                                        ) : (
                                                            <img src={mission.image_url} alt="Proof" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* VERIFICATION AREA (Expandable) */}
                                    <AnimatePresence>
                                        {isBeingVerified && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-black/40 border-t border-white/5"
                                            >
                                                <div className="p-4">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setVerifyMode('media')}
                                                                className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${verifyMode === 'media' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                            >
                                                                <Camera size={14} /> Photo/Video/Voice
                                                            </button>
                                                            <button
                                                                onClick={() => setVerifyMode('text')}
                                                                className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${verifyMode === 'text' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                            >
                                                                <PenTool size={14} /> Text
                                                            </button>
                                                        </div>
                                                        <button onClick={() => setVerifyingId(null)} className="text-slate-500 hover:text-white">
                                                            <X size={18} />
                                                        </button>
                                                    </div>

                                                    {verifyMode === 'text' ? (
                                                        <div className="space-y-3">
                                                            <textarea
                                                                value={textInput}
                                                                onChange={(e) => setTextInput(e.target.value)}
                                                                placeholder="Type your reflection or notes here..."
                                                                className="w-full h-24 bg-slate-900/80 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none resize-none"
                                                            />
                                                            <button
                                                                onClick={handleTextSubmit}
                                                                disabled={!textInput.trim()}
                                                                className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                                                            >
                                                                Complete Mission
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={triggerFileClick}
                                                            className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group"
                                                        >
                                                            <div className="flex gap-4 mb-2 text-slate-400 group-hover:text-primary transition-colors">
                                                                <Camera size={24} />
                                                                <Video size={24} />
                                                                <Mic size={24} />
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-300">Tap to upload</p>
                                                            <p className="text-[10px] text-slate-500">Photo, Video, or Audio</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}

                {/* Loop Closed Celebration */}
                {!loading && !isPreview && activeList.length > 0 && activeList.every(m => m.is_completed) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 p-4 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-2xl text-center shrink-0"
                    >
                        <p className="text-white font-bold text-sm">✨ Loop Closed!</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
