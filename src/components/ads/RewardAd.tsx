import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Volume2, VolumeX, Award } from 'lucide-react';
import GoogleAd from './GoogleAd';

interface RewardAdProps {
    onReward: () => void;
    onClose: () => void;
    adSlotId?: string;
}

export default function RewardAd({ onReward, onClose, adSlotId }: RewardAdProps) {
    const [timeLeft, setTimeLeft] = useState(10); // 10 Seconds Ad
    const [canClose, setCanClose] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanClose(true);
            setIsCompleted(true);
            // If it's a real ad, we might want to wait for user to close manually?
            // For now, auto-reward logic remains.
            if (!adSlotId) onReward();
        }
    }, [timeLeft]);

    // REAL AD MODE
    if (adSlotId) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4"
            >
                <div className="w-full max-w-lg bg-white rounded-xl overflow-hidden relative">
                    <div className="bg-slate-100 p-2 flex justify-between items-center border-b">
                        <span className="text-xs font-bold text-slate-500">Sponsored</span>
                        {canClose ? (
                            <button onClick={() => { onReward(); onClose(); }} className="text-black font-bold text-xs bg-slate-200 px-3 py-1 rounded-full">
                                Close X
                            </button>
                        ) : (
                            <span className="text-xs text-slate-400">Reward in {timeLeft}s</span>
                        )}
                    </div>

                    <div className="min-h-[300px] bg-slate-50 relative flex items-center justify-center overflow-hidden">
                        {/* Placeholder Content (Visible if Ad is empty/loading) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-50 pointer-events-none">
                            <motion.div
                                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4"
                            >
                                <Award className="text-slate-400" size={32} />
                            </motion.div>
                            <p className="text-slate-400 font-bold text-sm">Ad Loading...</p>
                            <p className="text-slate-300 text-xs mt-1">Waiting for ad inventory</p>
                        </div>

                        {/* Actual Ad Component (Z-Index higher to cover placeholder) */}
                        <div className="relative z-10 w-full">
                            <GoogleAd slotId={adSlotId} className="w-full text-center" />
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t relative z-20">
                        <p className="text-center text-sm text-slate-600">
                            {canClose ? "Thank you! Reward Unlocked." : "Please wait to unlock your reward."}
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    // MOCK MODE (Original)
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center p-0"
        >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                <div className="text-white text-xs bg-black/50 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">
                    {timeLeft > 0 ? `Reward in ${timeLeft}s` : 'Reward Granted'}
                </div>
                {canClose && (
                    <button
                        onClick={onClose}
                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-md transition-all"
                    >
                        <X size={24} />
                    </button>
                )}
            </div>

            {/* Ad Content (Simulated Video) */}
            <div className="w-full h-full max-w-md bg-slate-900 relative flex flex-col">
                <div className="flex-1 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
                    {/* Background Animation */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500 rounded-full blur-[100px] animate-pulse" />
                        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-purple-500 rounded-full blur-[100px] animate-pulse delay-700" />
                    </div>

                    <div className="z-10 text-center p-8">
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-xl mb-6 inline-block shadow-2xl"
                        >
                            <img src="/reme_icon.png" alt="App Icon" className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">My Re Design</h2>
                        <p className="text-blue-200 text-lg mb-8 font-medium">Reclaim your rhythm.</p>

                        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 inline-block">
                            <p className="text-xs text-slate-300 uppercase tracking-widest font-bold mb-1">Sponsored Ad</p>
                            <p className="text-white font-bold">Google Ads (Simulation)</p>
                        </div>
                    </div>

                    {/* Video Controls Simulation */}
                    <div className="absolute bottom-10 left-6 right-6 flex items-center gap-4">
                        <div className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 5, ease: "linear" }}
                                className="h-full bg-primary"
                            />
                        </div>
                        <button onClick={() => setIsMuted(!isMuted)} className="text-white/80 hover:text-white">
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className={`p-6 bg-slate-950 border-t border-white/10 transition-all duration-500 ${isCompleted ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Award className="text-yellow-400" size={24} />
                        <div>
                            <p className="text-white font-bold">Reward Unlocked!</p>
                            <p className="text-slate-400 text-xs">You can now access today's missions.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        Close & Continue
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
