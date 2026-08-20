import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Timer } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GoldenTimePopupProps {
    isOpen: boolean;
    onClose: () => void;
    onClaim: () => void;
}

export default function GoldenTimePopup({ isOpen, onClose, onClaim }: GoldenTimePopupProps) {
    const [timeLeft, setTimeLeft] = useState(24 * 60 * 60); // 24 hours in seconds

    useEffect(() => {
        if (!isOpen) return;
        
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, onClose]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden relative border border-yellow-500/30"
                    >
                        {/* Glow effect */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-yellow-500/20 blur-[50px] pointer-events-none"></div>
                        
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-8 text-center relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.4)] animate-bounce-slow">
                                <Gift size={40} className="text-black" />
                            </div>

                            <h2 className="text-2xl font-black text-white mb-2">골든 타임 해제!</h2>
                            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                                7일 연속 미션 달성을 축하합니다!<br/>
                                <span className="font-bold text-yellow-400">Pro 연간 플랜 50% 할인 쿠폰</span>을 드립니다.
                            </p>

                            <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full mb-8 border border-white/5">
                                <Timer size={14} className="text-yellow-500" />
                                <span className="text-yellow-500 font-mono font-bold text-sm">
                                    {formatTime(timeLeft)} 남음
                                </span>
                            </div>

                            <button
                                onClick={onClaim}
                                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-lg rounded-2xl shadow-lg hover:brightness-110 transition-all active:scale-95"
                            >
                                쿠폰 받고 Pro 업그레이드
                            </button>
                            <button
                                onClick={onClose}
                                className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-400 transition-colors"
                            >
                                괜찮습니다, 다음에 할게요
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
