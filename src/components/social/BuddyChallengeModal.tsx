import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface BuddyChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner: any; // friend object
}

export default function BuddyChallengeModal({ isOpen, onClose, partner }: BuddyChallengeModalProps) {
    const { user } = useStore();
    const [category, setCategory] = useState(partner?.userGoal?.category || partner?.goalCategory || 'body_wellness');
    const [challengeName, setChallengeName] = useState(partner?.userGoal?.target_text || partner?.goalTarget ? `${partner?.userGoal?.target_text || partner?.goalTarget}` : '');
    const [durationDays, setDurationDays] = useState(7);
    const [dailyCount, setDailyCount] = useState(1);
    const [loading, setLoading] = useState(false);

    // Keep category in sync if partner changes
    useEffect(() => {
        if (partner) {
            setCategory(partner.userGoal?.category || partner.goalCategory || 'body_wellness');
            setChallengeName(partner.userGoal?.target_text || partner.goalTarget ? `${partner.userGoal?.target_text || partner.goalTarget}` : '');
        }
    }, [partner]);

    const handleSubmit = async () => {
        if (!user || !partner) return;
        setLoading(true);

        try {
            // 1. Get exact authenticated user ID
            const { data: authData } = await supabase.auth.getUser();
            const creatorId = authData?.user?.id || user.id;
            const partnerId = partner.id || partner.user_id || partner.userGoal?.user_id;

            if (!partnerId) {
                alert('상대방 유저 정보를 찾을 수 없습니다.');
                return;
            }

            if (creatorId === partnerId) {
                alert('자기 자신에게는 챌린지를 신청할 수 없습니다.');
                return;
            }

            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + durationDays);
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            const baseName = challengeName.trim() || `${partner?.name || '친구'}님과의 대결`;
            const finalChallengeName = dailyCount > 1 ? `${baseName} [1일 ${dailyCount}회]` : baseName;

            const { data, error } = await supabase.from('buddy_challenges').insert({
                creator_id: creatorId,
                partner_id: partnerId,
                goal_category: category,
                challenge_name: finalChallengeName,
                start_date: dateStr,
                end_date: endDateStr,
                status: 'pending'
            }).select();

            if (error) {
                console.error('[BUDDY CHALLENGE] Insert error:', error);
                alert(`챌린지 생성 실패: ${error.message || error.details || JSON.stringify(error)}`);
                return;
            }

            console.log('[BUDDY CHALLENGE] Created successfully:', data);
            alert(`[${partner?.name || '친구'}]님에게 ${durationDays}일 버디 챌린지 요청을 보냈습니다!`);
            onClose();
        } catch (e: any) {
            console.error('[BUDDY CHALLENGE] Unexpected error:', e);
            alert(`챌린지 생성 실패: ${e?.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
                >
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center mb-5">
                        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-2.5 text-primary">
                            <Swords size={28} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">1:1 버디 챌린지 신청</h2>
                        <p className="text-xs text-slate-400">
                            <span className="font-bold text-white">{partner?.name}</span>님과 목표를 걸고 함께 대결하세요!
                        </p>
                    </div>

                    <div className="space-y-4 mb-6">
                        {/* 기간 선택 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                                챌린지 기간 (대결 일수)
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[3, 7, 14, 30].map(days => (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => setDurationDays(days)}
                                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                                            durationDays === days
                                                ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                                                : 'bg-slate-800 text-slate-400 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        {days}일{days === 7 ? '🔥' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 일일 인증 횟수 선택 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                                하루 인증 횟수 (1일 미션 수)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(cnt => (
                                    <button
                                        key={cnt}
                                        type="button"
                                        onClick={() => setDailyCount(cnt)}
                                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                                            dailyCount === cnt
                                                ? 'bg-accent text-black border-accent shadow-lg shadow-accent/20'
                                                : 'bg-slate-800 text-slate-400 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        {cnt}회{cnt === 1 ? ' (기본)' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">카테고리</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-primary outline-none"
                            >
                                <option value="body_wellness">💪 신체적 건강 (Body & Wellness)</option>
                                <option value="mind_connection">🧘 마음 & 연결 (Mind & Connection)</option>
                                <option value="growth_career">🚀 성장 & 커리어 (Growth & Career)</option>
                                <option value="funplay">🎮 소소한 재미 (FunPlay)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">대결 미션 목표</label>
                            <input
                                type="text"
                                value={challengeName}
                                onChange={(e) => setChallengeName(e.target.value)}
                                placeholder="예: 매일 산책 30분하기"
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-primary outline-none placeholder:text-slate-600"
                            />
                        </div>

                        {/* 안내 문구 */}
                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-400 leading-relaxed">
                            💡 별도의 AI 미션 없이 입력하신 <span className="text-primary font-bold">"{challengeName || '대결 미션'}"</span>이 하루 <span className="text-accent font-bold">{dailyCount}개 미션</span>으로 생성되며, 사진 인증 시 대결 완수로 즉시 기록됩니다.
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-black text-sm font-extrabold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {loading ? '요청 전송 중...' : `${durationDays}일 챌린지 신청하기 🔥`}
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
