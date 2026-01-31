import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, CheckCircle, Heart, MessageCircle, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';

interface HistoryDetailProps {
    goal: any;
    onClose: () => void;
}

export default function HistoryDetail({ goal, onClose }: HistoryDetailProps) {
    const { t } = useLanguage();
    const [missions, setMissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [stats, setStats] = useState<{ likes: number, comments: any[] }>({ likes: 0, comments: [] });

    useEffect(() => {
        fetchMissionHistory();
    }, [goal]);

    const fetchMissionHistory = async () => {
        setLoading(true);
        // Fetch completed missions for this goal's category and roughly within its timeframe?
        // Better: If missions have 'seq', use that. 
        // If not, we fall back to category + date range (created_at to created_at + duration).

        // Calculate Date Range
        const startDate = new Date(goal.created_at);
        startDate.setDate(startDate.getDate() - 1); // Buffer for timezone diffs (UTC vs Local)

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + goal.duration_months + 1); // Add extra month buffer just in case

        let query = supabase.from('missions')
            .select('*')
            .eq('user_id', goal.user_id)
            .eq('category', goal.category)
            .eq('seq', goal.seq || 1) // Strict Sequence Filter
            .eq('is_completed', true)
            .gte('date', startDate.toISOString().split('T')[0]) // Start Date
            .order('date', { ascending: true });

        // Removed .lt(endDate) constraint to prevent hiding recent missions if duration calc is off. 
        // We mainly care that it started AFTER the goal was created.
        // And if there's a newer goal (higher seq), we might want to cap it, but for now showing all is safer.

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

    // Stats
    const totalVerified = missions.length;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
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
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X size={24} className="text-white" />
                </button>
            </div>

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
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                            >
                                {/* Date Header */}
                                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-mono text-primary font-bold">{m.date}</span>
                                    {m.proof_type === 'image' && <ImageIcon size={14} className="text-slate-500" />}
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

            {/* Lightbox / Image Modal */}
            {selectedImage && (
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
            )}
        </div>
    );
}
