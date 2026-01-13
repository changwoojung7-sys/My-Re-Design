import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';

interface AdWarningProps {
    onWatchAd: () => void;
    onSubscribe: () => void;
    currentDay: number;
}

export default function AdWarning({ onWatchAd, onSubscribe, currentDay }: AdWarningProps) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl relative overflow-hidden"
            >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                <div className="flex justify-center mb-6 mt-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <Play size={32} className="text-blue-400 fill-blue-400 ml-1" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white text-center mb-2">
                    무료 체험 종료 <br />(Day {currentDay})
                </h2>
                <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
                    짧은 동영상 광고를 시청하고 <br />
                    오늘의 미션을 무료로 확인하세요.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={onWatchAd}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 group"
                    >
                        <Play size={18} className="fill-white" />
                        광고 보고 잠금 해제
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-slate-900 text-slate-500">또는 프리미엄 전환</span>
                        </div>
                    </div>

                    <button
                        onClick={onSubscribe}
                        className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        프리미엄 가입 (광고 제거)
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
