import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, CheckCircle, Heart, MessageCircle, User, Clapperboard, Trash2, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';
import MissionReel from '../../components/common/MissionReel';
import RewardAd from '../../components/ads/RewardAd';
import AdWarning from '../Home/AdWarning';
import Paywall from '../Home/Paywall';
import { useStore } from '../../lib/store';

interface HistoryDetailProps {
    goal: any;
    onClose: () => void;
    onMissionsChanged?: () => void;
}

export default function HistoryDetail({ goal, onClose, onMissionsChanged }: HistoryDetailProps) {
    const { user } = useStore();
    const { t } = useLanguage();
    const [missions, setMissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showReel, setShowReel] = useState(false);
    const [showAd, setShowAd] = useState(false);
    const [showAdWarning, setShowAdWarning] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [stats, setStats] = useState<{ likes: number, comments: any[] }>({ likes: 0, comments: [] });
    const [dayCount, setDayCount] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchMissionHistory();
        checkSubscriptionAccess();
    }, [goal]);

    const checkSubscriptionAccess = async () => {
        if (!user) return;

        // ... (Free Trial Logic - Phase 1 etc) ... 
        // Logic truncated for brevity in replace block, but need to preserve existing logic if not changing?
        // Wait, replace_file_content replaces the whole block.
        // I need to be careful not to delete the logic I just fixed.
        // It's safer to just inject the imports and state first, then the render logic.
        // Or re-implement the checkSubscriptionAccess carefully.

        // Let's re-implement checkSubscriptionAccess with the recent fix (using goal.created_at) + day calculation

        // Priority 1: Funplay
        if (goal.category === 'funplay') {
            setHasAccess(true);
            return;
        }

        // Priority 2: Active Subscription
        const { data: subs } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('end_date', new Date().toISOString());

        if (subs && subs.length > 0) {
            const hasAllAccess = subs.some((s: any) => s.type === 'all');
            const hasCategoryAccess = subs.some((s: any) => s.type === 'mission' && s.target_id === goal.category);

            if (hasAllAccess || hasCategoryAccess) {
                setHasAccess(true);
                return;
            }
        }

        // Priority 3: Trial Phase 1 (0-7 Days)
        let createdDate = new Date();
        if (goal.created_at) {
            createdDate = new Date(goal.created_at);
        } else {
            // Fallback
            const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
            if (profile?.created_at) {
                createdDate = new Date(profile.created_at);
            }
        }

        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDayCount(diffDays);

        if (diffDays <= 7) {
            setHasAccess(true);
            return;
        }

        // Use custom free trial days as override if present
        if (user.custom_free_trial_days && user.custom_free_trial_days > 0) {
            setHasAccess(true);
            return;
        }

        setHasAccess(false);
    };

    const handlePlayClick = () => {
        if (hasAccess) {
            setShowReel(true);
        } else {
            // Phase 2 (Day 8-21): Just Ad
            if (dayCount <= 21) {
                setShowAd(true);
            } else {
                // Phase 3+ (Day 22+): Warning First
                setShowAdWarning(true);
            }
        }
    };

    // ... fetchMissionHistory (unchanged) ...

    const fetchMissionHistory = async () => {
        setLoading(true);
        const startDate = new Date(goal.created_at);
        startDate.setDate(startDate.getDate() - 1);

        let query = supabase.from('missions')
            .select('*')
            .eq('user_id', goal.user_id)
            .eq('category', goal.category)
            .eq('seq', goal.seq || 1)
            .eq('is_completed', true)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        const { data } = await query;
        if (data) setMissions(data);

        // Fetch Social Stats
        const { count: likesCount } = await supabase
            .from('goal_likes')
            .select('*', { count: 'exact', head: true })
            .eq('goal_id', goal.id);

        const { data: commentsData } = await supabase
            .from('goal_comments')
            .select('*, profiles:user_id(nickname, profile_image_url)')
            .eq('goal_id', goal.id)
            .order('created_at', { ascending: false });

        setStats({
            likes: likesCount || 0,
            comments: commentsData || []
        });

        setLoading(false);
    };

    const handleDeleteMission = async (mission: any) => {
        setDeleting(true);
        try {
            // Delete associated storage file if exists
            if (mission.image_url) {
                try {
                    const url = new URL(mission.image_url);
                    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
                    if (pathMatch) {
                        const [, bucket, filePath] = pathMatch;
                        await supabase.storage.from(bucket).remove([filePath]);
                    }
                } catch { /* storage cleanup is best-effort */ }
            }

            // Delete mission from DB
            const { error } = await supabase
                .from('missions')
                .delete()
                .eq('id', mission.id);

            if (error) {
                console.error('Failed to delete mission:', error);
                alert('삭제에 실패했습니다.');
            } else {
                setMissions(prev => prev.filter(m => m.id !== mission.id));
                onMissionsChanged?.();
            }
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    // Stats
    const totalVerified = missions.length;

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-black/50 border-b border-white/10 shrink-0">
                <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                        Challenge #{goal.seq || 1}
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">
                        {goal.target_text || t[goal.category as keyof typeof t]}
                    </h2>
                </div>
                <div className="flex gap-2">
                    {missions.length > 0 && (
                        <>
                            <button
                                onClick={() => setEditMode(!editMode)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold transition-all ${editMode
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                    }`}
                            >
                                <Pencil size={14} />
                                {editMode ? '완료' : '수정'}
                            </button>
                            {!editMode && (
                                <button
                                    onClick={handlePlayClick}
                                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full text-white text-sm font-bold shadow-lg hover:shadow-purple-500/30 transition-all animate-pulse"
                                >
                                    <Clapperboard size={16} />
                                    Play Movie
                                    {!hasAccess && <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">AD</span>}
                                </button>
                            )}
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>
            </div>

            {/* Ad Warning Modal - Encourages Subscription */}
            {showAdWarning && (
                <AdWarning
                    currentDay={dayCount}
                    onWatchAd={() => {
                        setShowAdWarning(false);
                        setShowAd(true);
                    }}
                    onSubscribe={() => {
                        setShowAdWarning(false);
                        setShowPaywall(true);
                    }}
                    onClose={() => setShowAdWarning(false)}
                />
            )}

            {/* Paywall Modal */}
            {showPaywall && (
                <Paywall onClose={() => setShowPaywall(false)} />
            )}

            {/* Ad Modal */}
            {showAd && (
                <RewardAd
                    onReward={() => {
                        setShowAd(false);
                        setShowReel(true);
                    }}
                    onClose={() => setShowAd(false)}
                />
            )}

            {/* Reel Modal */}
            {
                showReel && (
                    <MissionReel
                        missions={missions}
                        category={goal.category}
                        onClose={() => setShowReel(false)}
                    />
                )
            }

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 pb-20 custom-scrollbar">

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-3 mb-8">
                    <div className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
                        <CheckCircle size={24} className="text-accent mb-1" />
                        <span className="text-xl font-bold text-white">{totalVerified}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Completed</span>
                    </div>

                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                        <Heart size={20} className="text-pink-500 mb-1" fill={stats.likes > 0 ? "currentColor" : "none"} />
                        <span className="text-lg font-bold text-white">{stats.likes}</span>
                        <span className="text-[10px] text-slate-400">Likes</span>
                    </div>

                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                        <MessageCircle size={20} className="text-blue-400 mb-1" />
                        <span className="text-lg font-bold text-white">{stats.comments.length}</span>
                        <span className="text-[10px] text-slate-400">Comments</span>
                    </div>
                </div>

                {/* Recent Comments Preview (if any) */}
                {stats.comments.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <MessageCircle size={14} /> Recent Cheering
                        </h3>
                        <div className="space-y-3">
                            {stats.comments.slice(0, 2).map((comment: any) => (
                                <div key={comment.id} className="bg-white/5 rounded-xl p-3 flex gap-3 border border-white/5">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                        {comment.profiles?.profile_image_url ? (
                                            <img src={comment.profiles.profile_image_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={14} className="text-slate-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white mb-0.5">{comment.profiles?.nickname || 'Unknown'}</p>
                                        <p className="text-xs text-slate-300 line-clamp-2">{comment.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Timeline Feed */}
                <div className="mt-2 space-y-6">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Loading history...</div>
                    ) : missions.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <p className="text-slate-400">No missions completed yet.</p>
                        </div>
                    ) : (
                        missions.map((m, i) => (
                            <motion.div
                                key={m.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: i * 0.05 }}
                                className={`bg-white/5 border rounded-2xl overflow-hidden transition-all ${editMode ? 'border-red-500/20' : 'border-white/10'
                                    }`}
                            >
                                {/* Date Header */}
                                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-mono text-primary font-bold">{m.date}</span>
                                    <div className="flex items-center gap-2">
                                        {m.proof_type === 'image' && <ImageIcon size={14} className="text-slate-500" />}
                                        {editMode && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                                                className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-[10px] font-bold transition-all"
                                            >
                                                <Trash2 size={12} />
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="p-4">
                                    <p className="text-white font-medium mb-3 text-sm leading-relaxed">
                                        {m.content}
                                    </p>

                                    {/* Media Proof */}
                                    {m.image_url && (
                                        <div className="mb-3">
                                            {m.proof_type === 'video' ? (
                                                <video
                                                    src={m.image_url}
                                                    controls
                                                    className="w-full h-auto object-cover max-h-64 rounded-xl border border-white/10"
                                                />
                                            ) : m.proof_type === 'audio' ? (
                                                <audio
                                                    src={m.image_url}
                                                    controls
                                                    className="w-full mt-2"
                                                />
                                            ) : (
                                                <div
                                                    className="rounded-xl overflow-hidden border border-white/10 cursor-pointer"
                                                    onClick={() => setSelectedImage(m.image_url)}
                                                >
                                                    <img
                                                        src={m.image_url}
                                                        alt="Proof"
                                                        className="w-full h-auto object-cover max-h-64"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Text Proof */}
                                    {m.proof_text && (
                                        <div className="bg-black/30 rounded-lg p-3 text-xs text-slate-300 italic border-l-2 border-slate-600">
                                            "{m.proof_text}"
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                    >
                        <div className="text-center mb-4">
                            <Trash2 size={32} className="text-red-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-white mb-2">미션 삭제</h3>
                            <p className="text-sm text-slate-400">
                                이 미션을 삭제하시겠습니까?<br />
                                <span className="text-red-400 text-xs">삭제된 미션은 복구할 수 없습니다.</span>
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 bg-white/5 rounded-lg p-3 mb-4 line-clamp-2">
                            {deleteTarget.content}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => handleDeleteMission(deleteTarget)}
                                disabled={deleting}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                            >
                                {deleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Lightbox / Image Modal */}
            {
                selectedImage && (
                    <div
                        className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-4"
                        onClick={() => setSelectedImage(null)}
                    >
                        <img
                            src={selectedImage}
                            alt="Full Screen"
                            className="max-w-full max-h-full rounded-lg shadow-2xl"
                        />
                        <button className="absolute top-6 right-6 text-white bg-black/50 rounded-full p-2">
                            <X size={32} />
                        </button>
                    </div>
                )
            }
        </div >
    );
}
