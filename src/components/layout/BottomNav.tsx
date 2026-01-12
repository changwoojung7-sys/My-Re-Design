import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Users, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
    onOpenSupport: (view?: 'main' | 'terms' | 'privacy' | 'refund') => void;
}

export default function BottomNav({ onOpenSupport }: BottomNavProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'My Loop', icon: Home },
        { path: '/today', label: 'Today', icon: Calendar },
        { path: '/dashboard', label: 'Growth', icon: ArrowUpRight },
        { path: '/history', label: 'History', icon: Trophy },
        { path: '/friends', label: 'Friends', icon: Users },
    ];

    return (
        <div className="w-full bg-slate-900/90 backdrop-blur-md border-t border-white/5 pb-1 pt-2 relative flex flex-col items-center">
            {/* Tab Navigation */}
            <div className="w-full flex justify-around items-center mb-0.5">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className="relative flex flex-col items-center justify-center p-2 w-14"
                        >
                            <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/20 text-primary scale-110' : 'text-slate-400 hover:text-slate-200'}`}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-glow"
                                        className="absolute inset-0 bg-primary/20 blur-lg rounded-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </div>
                            <span className={`text-[9px] mt-0.5 font-medium transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Business Info / Support Links (Compact) */}
            <div className="w-full flex items-center justify-center gap-2 text-[9px] text-slate-600 pb-1">
                <button onClick={() => onOpenSupport('main')} className="hover:text-slate-400 transition-colors">
                    문의하기
                </button>
                <span className="text-slate-800">|</span>
                <div className="flex gap-2">
                    <button onClick={() => onOpenSupport('terms')} className="hover:text-slate-400 transition-colors">이용약관</button>
                    <button onClick={() => onOpenSupport('privacy')} className="hover:text-slate-400 transition-colors">개인정보처리방침</button>
                    <button onClick={() => onOpenSupport('refund')} className="hover:text-slate-400 transition-colors">환불정책</button>
                </div>
            </div>
        </div>
    );
}
