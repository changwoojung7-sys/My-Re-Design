import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, CheckCircle } from 'lucide-react';
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

    useEffect(() => {
        fetchMissionHistory();
    }, [goal]);

    const fetchMissionHistory = async () => {
        setLoading(true);
        // Fetch completed missions for this goal's category and roughly within its timeframe?
        // Better: If missions have 'seq', use that. 
        // If not, we fall back to category + date range (created_at to created_at + duration).

        let query = supabase.from('missions')
            .select('*')
            .eq('user_id', goal.user_id)
            .eq('category', goal.category)
            .eq('is_completed', true)
            .order('date', { ascending: true });

        // If missions have seq, match it.
        if (goal.seq) {
            query = query.eq('seq', goal.seq);
        } else {
            // Legacy fallback (optional): Filter by date
            // const start = new Date(goal.created_at);
            // const end = new Date(start); end.setMonth(end.getMonth() + goal.duration_months);
            // query = query.gte('date', ...).lte('date', ...)
        }

        const { data } = await query;
        if (data) setMissions(data);
        setLoading(false);
    };

    // Stats
    const totalVerified = missions.length;
    const photoMissions = missions.filter(m => m.image_url);

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
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <CheckCircle size={28} className="text-accent mb-2" />
                        <span className="text-2xl font-bold text-white">{totalVerified}</span>
                        <span className="text-xs text-slate-400 uppercase font-bold">Missions Complete</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <ImageIcon size={28} className="text-pink-400 mb-2" />
                        <span className="text-2xl font-bold text-white">{photoMissions.length}</span>
                        <span className="text-xs text-slate-400 uppercase font-bold">Memories Captured</span>
                    </div>
                </div>

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

                                    {/* Image Proof */}
                                    {m.image_url && (
                                        <div
                                            className="rounded-xl overflow-hidden border border-white/10 cursor-pointer mb-3"
                                            onClick={() => setSelectedImage(m.image_url)}
                                        >
                                            <img
                                                src={m.image_url}
                                                alt="Proof"
                                                className="w-full h-auto object-cover max-h-64"
                                            />
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
