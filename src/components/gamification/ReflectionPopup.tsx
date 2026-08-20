import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface ReflectionPopupProps {
    isOpen: boolean;
    onClose: () => void;
    goalCategory: string;
    date?: string;
    onSaved?: () => void;
}

export default function ReflectionPopup({ isOpen, onClose, goalCategory, date, onSaved }: ReflectionPopupProps) {
    const { user } = useStore();
    const [reflection, setReflection] = useState('');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const today = new Date();
    const targetDate = date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        if (!isOpen || !user) return;
        setSaved(false);

        // 1. Try LocalStorage (Unified by Date)
        const localKey = `ai_reflections_${user.id}_${targetDate}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.reflection_text || parsed.answer) {
                    setReflection(parsed.reflection_text || parsed.answer || '');
                    setExistingAiResponse(parsed.ai_response || null);
                    return;
                }
            } catch (e) {}
        }

        // Also check legacy category-keyed local data if unified not found
        const legacyKey = `ai_reflections_${user.id}_${targetDate}_${goalCategory}`;
        const legacyData = localStorage.getItem(legacyKey);
        if (legacyData) {
            try {
                const parsed = JSON.parse(legacyData);
                if (parsed.reflection_text || parsed.answer) {
                    setReflection(parsed.reflection_text || parsed.answer || '');
                    setExistingAiResponse(parsed.ai_response || null);
                    return;
                }
            } catch (e) {}
        }

        // 2. Try DB for logged-in user
        if (user.id !== 'demo123') {
            supabase
                .from('ai_reflections')
                .select('*')
                .eq('user_id', user.id)
                .eq('mission_date', targetDate)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data }) => {
                    if (data) {
                        setReflection(data.answer || data.reflection_text || '');
                        setExistingAiResponse(data.ai_response || null);
                    }
                });
        }
    }, [isOpen, targetDate, goalCategory, user]);

    const handleSubmit = async () => {
        if (!reflection.trim() || !user) return;
        setLoading(true);
        try {
            const dateStr = targetDate;
            const aiComment = '오늘도 성장을 위한 소중한 회고를 남겨주셨네요. 남겨주신 인사이트를 다음 AI 코칭과 미션 난이도에 적극 반영하겠습니다! ✨';

            // Save locally unified by date so all categories share the same daily reflection
            const localKey = `ai_reflections_${user.id}_${dateStr}`;
            localStorage.setItem(localKey, JSON.stringify({
                user_id: user.id,
                category: goalCategory,
                reflection_text: reflection,
                answer: reflection,
                ai_response: aiComment,
                mission_date: dateStr,
                created_at: new Date().toISOString()
            }));

            // Also keep category key updated for compatibility
            localStorage.setItem(`ai_reflections_${user.id}_${dateStr}_${goalCategory}`, JSON.stringify({
                user_id: user.id,
                category: goalCategory,
                reflection_text: reflection,
                answer: reflection,
                ai_response: aiComment,
                mission_date: dateStr,
                created_at: new Date().toISOString()
            }));

            if (user.id !== 'demo123') {
                // Check if reflection for today already exists -> UPDATE instead of inserting duplicate
                const { data: existingRef } = await supabase
                    .from('ai_reflections')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('mission_date', dateStr)
                    .maybeSingle();

                if (existingRef?.id) {
                    // Update existing reflection
                    await supabase
                        .from('ai_reflections')
                        .update({
                            answer: reflection,
                            ai_response: aiComment
                        })
                        .eq('id', existingRef.id);
                } else {
                    // Insert new reflection
                    const { error: primaryError } = await supabase.from('ai_reflections').insert({
                        user_id: user.id,
                        mission_date: dateStr,
                        question: '오늘 미션을 진행하면서 느낀 점이나 내일 발전하고 싶은 점은 무엇인가요?',
                        answer: reflection,
                        ai_response: aiComment
                    });

                    if (primaryError) {
                        console.warn('Primary ai_reflections schema insert failed, trying legacy schema fallback:', primaryError);
                        await supabase.from('ai_reflections').insert({
                            user_id: user.id,
                            category: goalCategory,
                            reflection_text: reflection,
                            date: dateStr
                        });
                    }
                }
            }

            setSaved(true);
            onSaved?.();
            setTimeout(() => {
                onClose();
            }, 1800);
        } catch (e: any) {
            console.error('Reflection save error:', e);
            setSaved(true);
            onSaved?.();
            setTimeout(() => {
                onClose();
            }, 1800);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 pb-0">
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Bot size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">AI Coach</h3>
                                    <p className="text-[10px] text-slate-400">오늘의 미션 회고</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 flex-1 overflow-y-auto">
                            {!saved ? (
                                <div className="space-y-4">
                                    <div className="bg-white/5 rounded-2xl p-4 rounded-tl-sm w-[90%] border border-white/5">
                                        <p className="text-sm text-slate-200 leading-relaxed">
                                            오늘 미션을 모두 완료하셨네요! 수고하셨습니다. 🎉<br/><br/>
                                            진행하면서 느낀 점이나 어려웠던 부분, 내일은 어떻게 더 발전하고 싶은지 편하게 남겨주세요. 남겨주신 회고는 다음 AI 코칭에 반영됩니다.
                                        </p>
                                    </div>

                                    <div className="relative">
                                        <textarea
                                            value={reflection}
                                            onChange={(e) => setReflection(e.target.value)}
                                            placeholder="예: 오늘은 미션을 달성해서 뿌듯했지만 시간이 너무 촉박했다."
                                            className="w-full h-32 bg-slate-900 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none transition-colors"
                                            maxLength={300}
                                        />
                                        <div className="absolute bottom-3 right-3 text-[10px] text-slate-500">
                                            {reflection.length} / 300
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || reflection.length < 5}
                                        className="w-full py-3.5 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? '저장 중...' : (
                                            <>
                                                <Send size={16} />
                                                회고 전송하기
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-10"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                        <Sparkles size={32} className="text-green-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">회고가 저장되었습니다!</h3>
                                    <p className="text-sm text-slate-400 text-center">
                                        오늘의 작은 기록이<br/>내일의 큰 성장을 만듭니다.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
