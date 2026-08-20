import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { Lock, Trophy } from "lucide-react";

interface Badge {
    id: string;
    key: string;
    name: string;
    emoji: string;
    description: string;
    condition: any;
}

interface UserBadge {
    badge_id: string;
    earned_at: string;
    badges: Badge;
}

interface TrophyRoomProps {
    userId: string;
}

export default function TrophyRoom({ userId }: TrophyRoomProps) {
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [earnedMap, setEarnedMap] = useState<Record<string, string>>({}); // badge_id -> earned_at
    const [selectedBadge, setSelectedBadge] = useState<(Badge & { earned_at?: string }) | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBadges();
    }, [userId]);

    const fetchBadges = async () => {
        setLoading(true);
        const [{ data: badges }, { data: userBadges }] = await Promise.all([
            supabase.from("badges").select("*").order("created_at"),
            supabase.from("user_badges").select("badge_id, earned_at, badges(*)").eq("user_id", userId),
        ]);

        setAllBadges(badges ?? []);

        const map: Record<string, string> = {};
        (userBadges as unknown as UserBadge[] ?? []).forEach(ub => {
            map[ub.badge_id] = ub.earned_at;
        });
        setEarnedMap(map);
        setLoading(false);
    };

    const earnedCount = Object.keys(earnedMap).length;
    const totalCount  = allBadges.length;

    if (loading) {
        return (
            <div className="glass-card p-4">
                <div className="animate-shimmer h-4 rounded-full w-32 mb-3" />
                <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="animate-shimmer h-14 w-14 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="glass-card p-4" id="trophy-room-card">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Trophy size={18} color="#FFD700" />
                        <span className="text-base font-black text-white">트로피 룸</span>
                    </div>
                    <span className="text-xs font-bold text-text-secondary">
                        <span className="text-brand-mint">{earnedCount}</span> / {totalCount}
                    </span>
                </div>

                {/* 진행률 바 */}
                <div className="w-full h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"
                        initial={{ width: "0%" }}
                        animate={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>

                {/* 뱃지 그리드 */}
                <div className="grid grid-cols-5 gap-2">
                    {allBadges.map((badge, i) => {
                        const isEarned = !!earnedMap[badge.id];
                        return (
                            <motion.button
                                key={badge.id}
                                id={`badge-${badge.key}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                                whileHover={{ scale: 1.12 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedBadge({ ...badge, earned_at: earnedMap[badge.id] })}
                                className="relative flex flex-col items-center justify-center p-1.5 rounded-2xl aspect-square"
                                style={{
                                    background:  isEarned ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
                                    border:      isEarned ? "1.5px solid rgba(255,215,0,0.35)" : "1px solid rgba(255,255,255,0.06)",
                                    boxShadow:   isEarned ? "0 0 12px rgba(255,215,0,0.15)" : "none",
                                }}
                            >
                                <span
                                    className="text-2xl leading-none"
                                    style={{ filter: isEarned ? "none" : "grayscale(1) opacity(0.25)" }}
                                >
                                    {badge.emoji}
                                </span>
                                {!isEarned && (
                                    <Lock size={8} className="absolute bottom-1 right-1 text-text-muted" />
                                )}
                                {isEarned && (
                                    <motion.div
                                        layoutId={`badge-glow-${badge.id}`}
                                        className="absolute inset-0 rounded-2xl pointer-events-none"
                                        style={{ background: "radial-gradient(circle at center, rgba(255,215,0,0.1), transparent 70%)" }}
                                    />
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* 뱃지 상세 모달 */}
            <AnimatePresence>
                {selectedBadge && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={() => setSelectedBadge(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 40 }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 glass-card p-6 flex flex-col items-center gap-3"
                            id="badge-detail-modal"
                        >
                            {/* 뱃지 이모지 */}
                            <motion.div
                                animate={selectedBadge.earned_at ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-6xl"
                                style={{ filter: selectedBadge.earned_at ? "none" : "grayscale(1) opacity(0.35)" }}
                            >
                                {selectedBadge.emoji}
                            </motion.div>

                            <div className="text-center">
                                <p className="text-lg font-black text-white">{selectedBadge.name}</p>
                                <p className="text-sm text-text-secondary mt-1">{selectedBadge.description}</p>
                            </div>

                            {selectedBadge.earned_at ? (
                                <div className="px-3 py-1.5 rounded-xl text-xs font-bold"
                                     style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.3)" }}>
                                    🎉 {new Date(selectedBadge.earned_at).toLocaleDateString("ko-KR")} 획득
                                </div>
                            ) : (
                                <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-text-muted"
                                     style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    🔒 아직 잠금 상태
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedBadge(null)}
                                className="w-full py-2 rounded-xl text-sm font-bold text-text-secondary transition-colors hover:text-white"
                                style={{ background: "rgba(255,255,255,0.05)" }}
                            >
                                닫기
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
