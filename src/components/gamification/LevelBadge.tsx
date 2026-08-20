import { motion } from "framer-motion";
import { calcLevelFromXp, LEVEL_TABLE } from "../../lib/gamification";
import { Zap } from "lucide-react";

interface LevelBadgeProps {
    totalXp: number;
    compact?: boolean; // 작은 사이즈 (헤더용)
}

// 레벨별 아이콘 색상
const getLevelColor = (level: number): string => {
    if (level >= 20) return "#FFD700"; // Gold
    if (level >= 15) return "#A3E635"; // Neon Lime
    if (level >= 10) return "#06B6D4"; // Cyan
    if (level >= 5)  return "#8B5CF6"; // Purple
    return "#10B981";                  // Mint
};

export default function LevelBadge({ totalXp, compact = false }: LevelBadgeProps) {
    const { level, title, nextLevelXp, progressPercent } = calcLevelFromXp(totalXp);
    const color = getLevelColor(level);
    const xpToNext = nextLevelXp ? nextLevelXp - totalXp : 0;

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black"
                    style={{ background: `${color}22`, border: `1.5px solid ${color}`, color }}
                >
                    {level}
                </div>
                <span className="text-sm font-bold" style={{ color }}>{title}</span>
            </div>
        );
    }

    return (
        <div
            className="glass-card p-4 flex flex-col gap-3"
            id="level-badge-card"
        >
            {/* 상단: 레벨 배지 + 타이틀 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* 레벨 원형 배지 */}
                    <motion.div
                        whileHover={{ scale: 1.08 }}
                        className="relative flex items-center justify-center w-14 h-14 rounded-2xl font-black text-xl"
                        style={{
                            background:  `linear-gradient(135deg, ${color}22, ${color}44)`,
                            border:      `2px solid ${color}`,
                            color,
                            boxShadow:   `0 0 20px ${color}33`,
                        }}
                    >
                        <span className="leading-none">Lv</span>
                        <span className="text-2xl absolute -bottom-1 -right-1 bg-bg-base rounded-lg px-1 border border-white/10 text-xs font-black leading-none py-0.5"
                              style={{ color, borderColor: `${color}66` }}>
                            {level}
                        </span>
                    </motion.div>

                    <div>
                        <p className="text-xs text-text-secondary font-medium">현재 칭호</p>
                        <p className="text-base font-black text-white">{title}</p>
                    </div>
                </div>

                {/* 총 XP */}
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
                     style={{ background: `${color}15`, border: `1px solid ${color}33` }}>
                    <Zap size={12} color={color} />
                    <span className="text-sm font-black" style={{ color }}>{totalXp.toLocaleString()}</span>
                    <span className="text-xs text-text-muted">XP</span>
                </div>
            </div>

            {/* XP 프로그레스 바 */}
            <div>
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-text-secondary font-medium">
                        다음 레벨까지
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                        {nextLevelXp
                            ? `${xpToNext.toLocaleString()} XP 남음`
                            : '최고 레벨 달성! 👑'
                        }
                    </span>
                </div>

                {/* 배경 바 */}
                <div className="w-full h-2.5 rounded-full overflow-hidden"
                     style={{ background: `${color}18` }}>
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                    />
                </div>

                {/* 레벨 마커 */}
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-text-muted">Lv.{level}</span>
                    {nextLevelXp && (
                        <span className="text-[10px] text-text-muted">
                            Lv.{level + 1} ({nextLevelXp.toLocaleString()} XP)
                        </span>
                    )}
                </div>
            </div>

            {/* 레벨 로드맵 미리보기 (다음 2개 레벨) */}
            {level < 20 && (
                <div className="flex gap-2 mt-0.5">
                    {LEVEL_TABLE.slice(level, Math.min(level + 3, 20)).map(row => (
                        <div
                            key={row.level}
                            className="flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            <span className="text-[9px] text-text-muted font-medium">Lv.{row.level}</span>
                            <span className="text-[10px] text-white font-semibold text-center leading-tight">{row.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
