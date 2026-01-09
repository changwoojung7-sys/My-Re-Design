import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, Users, User } from 'lucide-react';
import clsx from 'clsx';

export default function BottomNav() {
    const location = useLocation();
    const path = location.pathname;

    const navItems = [
        { icon: User, label: 'My Loop', href: '/' },
        { icon: Home, label: 'Mission', href: '/today' },
        { icon: BarChart2, label: 'Growth', href: '/dashboard' },
        { icon: Users, label: 'Friends', href: '/friends' },
    ];

    return (
        <div className="absolute bottom-0 w-full bg-slate-900/80 backdrop-blur-md border-t border-white/5 pb-6 pt-2">
            <div className="flex justify-around items-center">
                {navItems.map((item) => {
                    const isActive = path === item.href;
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className="flex flex-col items-center gap-1 p-3 relative"
                        >
                            {isActive && (
                                <div className="absolute -top-2 w-8 h-1 bg-primary rounded-full shadow-[0_0_10px_theme(colors.primary)]" />
                            )}
                            <item.icon
                                size={24}
                                className={clsx("transition-colors", isActive ? "text-white" : "text-slate-500")}
                            />
                            <span className={clsx("text-[10px] font-medium transition-colors", isActive ? "text-white" : "text-slate-500")}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
