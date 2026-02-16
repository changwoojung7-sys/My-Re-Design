import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const LOADING_MESSAGES = [
    "당신의 하루 패턴을 읽는 중...",
    "어제의 기록을 분석하는 중...",
    "오늘의 리듬을 설계하는 중...",
    "작지만 의미 있는 도전을 찾는 중...",
    "오늘, 잘 시작해볼까요?"
];

export default function MissionLoading() {
    const [msgIndex, setMsgIndex] = useState(0);

    // Text update interval (3 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Generate random stars for background effect
    const stars = Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3
    }));

    return (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden">
            {/* Background Stars (Random Positions) */}
            {stars.map((star) => (
                <motion.div
                    key={star.id}
                    className="absolute w-1 h-1 bg-white/40 rounded-full"
                    style={{ left: `${star.x}%`, top: `${star.y}%` }}
                    animate={{
                        opacity: [0.2, 0.8, 0.2],
                        scale: [1, 1.5, 1],
                    }}
                    transition={{
                        duration: star.duration,
                        repeat: Infinity,
                        delay: star.delay,
                        ease: "easeInOut"
                    }}
                />
            ))}

            {/* Constellation Build Animation */}
            <div className="relative w-64 h-40 mb-12 flex items-center justify-center">
                {/* 1. Main Stars (Card Corners) */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 160">
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
                            <stop offset="50%" stopColor="#c084fc" stopOpacity="1" />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Connecting Lines - Drawing effect */}
                    <motion.path
                        d="M 40,40 L 216,40 L 216,120 L 40,120 Z" // Rectangle path
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="1.5"
                        strokeDasharray="550" // Approximate path length
                        strokeDashoffset="550"
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }}
                    />

                    {/* Inner Diagonal Lines (Constellation feel) */}
                    <motion.path
                        d="M 40,40 L 216,120"
                        fill="none"
                        stroke="white"
                        strokeWidth="0.5"
                        strokeOpacity="0.3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, delay: 1, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                    />
                    <motion.path
                        d="M 216,40 L 40,120"
                        fill="none"
                        stroke="white"
                        strokeWidth="0.5"
                        strokeOpacity="0.3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, delay: 1.5, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                    />
                </svg>

                {/* Corner Stars */}
                {[
                    { left: '15%', top: '25%' },   // Top Left
                    { left: '85%', top: '25%' },   // Top Right
                    { left: '85%', top: '75%' },   // Bottom Right
                    { left: '15%', top: '75%' },   // Bottom Left
                ].map((pos, idx) => (
                    <motion.div
                        key={idx}
                        className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                        style={pos}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, delay: idx * 0.5, repeat: Infinity }}
                    />
                ))}

                {/* Central Pulse */}
                <motion.div
                    className="absolute"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                    <Sparkles size={32} className="text-primary/50" />
                </motion.div>
            </div>

            {/* Message Sequence with Fade Effect */}
            <div className="h-8 flex items-center justify-center px-6 text-center w-full max-w-sm">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={msgIndex}
                        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                        transition={{ duration: 0.5 }}
                        className="text-base font-medium text-white/90"
                    >
                        {LOADING_MESSAGES[msgIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Progress Indicator (Subtle) */}
            <div className="mt-8 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 20, ease: "linear" }} // Match total time approx
                />
            </div>
        </div>
    );
}
