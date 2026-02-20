import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

import { motion } from 'framer-motion';
import { X, Volume2, VolumeX, Award } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { showNativeRewardedAd, ADMOB_UNITS, initializeAdMob } from '../../lib/admob';

interface RewardAdProps {
    onReward: () => void;
    onClose: () => void;
    adSlotId?: string;
}

export default function RewardAd({ onReward, onClose, adSlotId }: RewardAdProps) {
    const { t } = useLanguage();
    const [timeLeft, setTimeLeft] = useState(5); // 5 Seconds Ad for Test
    const [canClose, setCanClose] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isNativeMode, setIsNativeMode] = useState(false);



    useEffect(() => {
        let listeners: any[] = [];
        let rewarded = false; // Guard against duplicate reward

        const setupAdMob = async () => {
            if (Capacitor.isNativePlatform()) {
                setIsNativeMode(true);

                await initializeAdMob();

                // Setup Listeners
                const onRewarded = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
                    console.log('User rewarded', reward);
                    if (!rewarded) {
                        rewarded = true;
                        onReward(); // Grant the reward
                    }
                    // Do NOT close here — let Dismissed handle UI teardown
                });

                const onDismissed = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                    console.log('Ad dismissed, was rewarded:', rewarded);
                    onClose(); // Always close the overlay
                });

                const onFailed = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
                    console.error('Ad failed to load', error);
                    setIsNativeMode(false); // Fallback to web mock
                });

                listeners = [onRewarded, onDismissed, onFailed];

                // Trigger Ad
                // Use REWARDED_PROD for release as per policy
                const adUnitId = ADMOB_UNITS.REWARDED_PROD;
                const success = await showNativeRewardedAd(adUnitId);

                if (!success) {
                    setIsNativeMode(false);
                }
            } else {
                setIsNativeMode(false);
            }
        };

        setupAdMob();

        return () => {
            listeners.forEach(l => l.remove());
        };
    }, [adSlotId]);

    // Timer Logic for Web Mock
    useEffect(() => {
        if (isNativeMode) return; // Don't run timer if native ad is handling it

        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanClose(true);
            setIsCompleted(true);
            // Auto-reward logic for web mock
            if (!adSlotId) {
                // Wait a bit before rewarding? No, instant is fine for mock.
            }
        }
    }, [timeLeft, isNativeMode, adSlotId]);

    // If Native Mode is active and successfully triggered, we might want to just render nothing
    // or a "Watcher" that listens for the callback.
    // For simplicity in this step, we assume 'window.Android' means we rely on native UI.
    // But since we can't test native here, we focus on the Web Mock part mostly.

    // REAL AD MODE (AdSense - Optional Legacy support)
    // CoreLoop Note: We are prioritizing AdMob (Native) or Mock (Web).
    // The legacy AdSense web-ad logic is temporarily disabled to allow testing the AdMob flow in browser.

    // (Legacy AdSense Block Removed for AdMob Testing)

    // MOCK MODE (For Browser Testing with Test ID behavior simulation)
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
                    {timeLeft > 0 ? `광고 시청 중... ${timeLeft}초` : '보상 지급 가능'}
                </div>
                {canClose && (
                    <button
                        onClick={() => { onReward(); onClose(); }}
                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-md transition-all"
                        title={t.closeButton}
                        aria-label={t.closeButton}
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
                            animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                            className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-xl mb-8 inline-block shadow-2xl"
                        >
                            <img src="/reme_icon.png" alt="App Icon" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        </motion.div>

                        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">광고를 불러오는 중입니다</h2>
                        <p className="text-slate-300 text-sm mb-8 animate-pulse">잠시만 기다려주세요...</p>

                        <div className="inline-flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                            <span className="text-xs text-slate-400">Secure Connection</span>
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
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="text-white/80 hover:text-white"
                            title={isMuted ? t.unmute : t.mute}
                            aria-label={isMuted ? t.unmute : t.mute}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className={`p-6 bg-slate-950 border-t border-white/10 transition-all duration-500 ${isCompleted ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-400/20 rounded-lg">
                            <Award className="text-yellow-400" size={24} />
                        </div>
                        <div>
                            <p className="text-white font-bold">보상 지급 완료!</p>
                            <p className="text-slate-400 text-xs">이제 보상을 받으실 수 있습니다.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { onReward(); onClose(); }}
                        className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors shadow-lg shadow-white/10"
                    >
                        닫기 & 보상 받기
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
