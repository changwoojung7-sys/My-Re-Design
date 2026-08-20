import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, TrendingUp, Play, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
    onOpenSupport: (view?: 'main' | 'terms' | 'privacy' | 'refund') => void;
}

const navItems = [
    { path: '/',          label: 'My Loop', icon: Home,        color: '#10B981' },
    { path: '/today',     label: 'Today',   icon: Calendar,    color: '#8B5CF6' },
    { path: '/dashboard', label: 'Growth',  icon: TrendingUp,  color: '#06B6D4' },
    { path: '/history',   label: 'History', icon: Play,        color: '#F97316' },
    { path: '/friends',   label: 'Friends', icon: Users,       color: '#FF5757' },
];

export default function BottomNav({ onOpenSupport }: BottomNavProps) {
    const navigate  = useNavigate();
    const location  = useLocation();

    return (
        <div className="w-full flex flex-col items-center pb-safe">
            {/* ── Floating Island Bar ── */}
            <div
                className="mx-4 mb-2 px-3 py-2 flex justify-around items-center w-[calc(100%-2rem)]"
                style={{
                    background:       'rgba(13, 20, 38, 0.85)',
                    backdropFilter:   'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border:           '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius:     '28px',
                    boxShadow:        '0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
                }}
            >
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon     = item.icon;

                    return (
                        <button
                            key={item.path}
                            id={`nav-${item.label.toLowerCase()}`}
                            onClick={() => navigate(item.path)}
                            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[52px]"
                        >
                            {/* 슬라이딩 배경 인디케이터 */}
                            {isActive && (
                                <motion.div
                                    layoutId="floating-nav-bg"
                                    className="absolute inset-0 rounded-2xl"
                                    style={{ backgroundColor: `${item.color}18` }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                />
                            )}

                            {/* 아이콘 */}
                            <motion.div
                                animate={isActive
                                    ? { scale: 1.15, y: -1 }
                                    : { scale: 1,    y: 0  }
                                }
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="relative z-10"
                            >
                                {/* 활성 시 glow */}
                                {isActive && (
                                    <div
                                        className="absolute inset-0 blur-md rounded-full"
                                        style={{ backgroundColor: `${item.color}40` }}
                                    />
                                )}
                                <Icon
                                    size={20}
                                    strokeWidth={isActive ? 2.5 : 1.8}
                                    color={isActive ? item.color : '#64748b'}
                                    className="relative z-10 transition-colors duration-200"
                                />
                            </motion.div>

                            {/* 라벨 */}
                            <span
                                className="text-[9px] font-semibold relative z-10 transition-all duration-200"
                                style={{ color: isActive ? item.color : '#475569' }}
                            >
                                {item.label}
                            </span>

                            {/* 활성 점 인디케이터 */}
                            {isActive && (
                                <motion.div
                                    layoutId="floating-nav-dot"
                                    className="absolute -bottom-1 w-1 h-1 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── 법적 링크 (최소화) ── */}
            <div className="flex items-center justify-center gap-2 text-[8px] text-slate-700 pb-1">
                <button
                    id="nav-support-btn"
                    onClick={() => onOpenSupport('main')}
                    className="hover:text-slate-500 transition-colors"
                >
                    문의
                </button>
                <span className="text-slate-800">·</span>
                <button onClick={() => onOpenSupport('terms')}   className="hover:text-slate-500 transition-colors">이용약관</button>
                <span className="text-slate-800">·</span>
                <button onClick={() => onOpenSupport('privacy')} className="hover:text-slate-500 transition-colors">개인정보</button>
                <span className="text-slate-800">·</span>
                <button onClick={() => onOpenSupport('refund')}  className="hover:text-slate-500 transition-colors">환불정책</button>
            </div>
        </div>
    );
}

