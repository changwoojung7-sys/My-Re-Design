import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { X, Download } from 'lucide-react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

interface ShareCardProps {
    isOpen: boolean;
    onClose: () => void;
    missions: any[];
    date: string;
}

export default function ShareCard({ isOpen, onClose, missions, date }: ShareCardProps) {
    const { user } = useStore();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const completedMissions = missions.filter(m => m.is_completed);
    const completionRate = missions.length > 0 ? Math.round((completedMissions.length / missions.length) * 100) : 0;

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 });
            download(dataUrl, `myredesign_daily_${date}.png`);
            
            // Log sharing event to DB
            if (user) {
                await supabase.from('share_cards').insert({
                    user_id: user.id,
                    card_type: 'daily_summary',
                    platform: 'download'
                });
            }
        } catch (err) {
            console.error('Failed to generate image', err);
            alert("이미지 저장에 실패했습니다.");
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-[320px] flex flex-col items-center"
                >
                    <button 
                        onClick={onClose} 
                        className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-white/10 rounded-full"
                    >
                        <X size={24} />
                    </button>

                    {/* 9:16 Aspect Ratio Card */}
                    <div 
                        ref={cardRef}
                        className="w-[300px] h-[533px] bg-gradient-to-br from-slate-900 via-slate-800 to-black rounded-[32px] overflow-hidden relative shadow-2xl border-4 border-slate-800 flex flex-col p-6"
                    >
                        {/* Background Effects */}
                        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent opacity-50 pointer-events-none" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent opacity-50 pointer-events-none" />

                        {/* Content */}
                        <div className="relative z-10 flex-1 flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-white font-black text-xl tracking-tighter">MyReDesign</span>
                                <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full text-white font-bold backdrop-blur-md">
                                    {new Date(date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>

                            {/* User Info */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-accent p-0.5">
                                    <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-white text-lg">
                                        {user?.nickname?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-lg leading-tight">{user?.nickname || 'User'}</h2>
                                    <p className="text-primary font-medium text-xs">Level {user?.current_level || 1} {user?.level_title}</p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/10">
                                <div className="text-center mb-2">
                                    <span className="text-xs text-slate-300 font-medium">Daily Completion</span>
                                </div>
                                <div className="flex items-end justify-center gap-1">
                                    <span className="text-5xl font-black text-white">{completionRate}</span>
                                    <span className="text-xl font-bold text-primary mb-1">%</span>
                                </div>
                            </div>

                            {/* Missions */}
                            <div className="flex-1">
                                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Today's Missions</h3>
                                <div className="space-y-2.5">
                                    {missions.slice(0, 4).map((m, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${m.is_completed ? 'bg-primary text-white' : 'bg-white/20 text-transparent'}`}>
                                                ✓
                                            </div>
                                            <p className={`text-sm font-medium line-clamp-2 ${m.is_completed ? 'text-white' : 'text-slate-400'}`}>
                                                {m.content}
                                            </p>
                                        </div>
                                    ))}
                                    {missions.length > 4 && (
                                        <div className="text-xs text-slate-500 font-medium ml-6">
                                            + {missions.length - 4} more
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer / Branding */}
                            <div className="mt-auto text-center pt-4 border-t border-white/10">
                                <p className="text-[10px] text-slate-400">Design Your Best Life</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleDownload}
                        disabled={isExporting}
                        className="mt-6 w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors active:scale-95 disabled:opacity-50"
                    >
                        {isExporting ? 'Generating...' : (
                            <>
                                <Download size={20} />
                                인스타그램 스토리로 공유하기
                            </>
                        )}
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
