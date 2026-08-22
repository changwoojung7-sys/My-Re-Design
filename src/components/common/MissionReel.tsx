import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Pause, Play as PlayIcon, Quote } from 'lucide-react';

interface MissionReelProps {
    missions: any[];
    category: string;
    onClose: () => void;
}

const MUSIC_MAP: Record<string, string> = {
    body_wellness: '/bgm_energy.mp3',
    growth_career: '/bgm_career.mp3',
    mind_connection: '/bgm_calm.mp3',
    funplay: '/bgm_fun.mp3',
};

// Gradient background map for text cards
const GRADIENT_MAP: Record<string, string> = {
    body_wellness: 'from-orange-500 to-red-600',
    growth_career: 'from-blue-600 to-purple-700',
    mind_connection: 'from-emerald-500 to-teal-700',
    funplay: 'from-pink-500 to-rose-600',
};

export default function MissionReel({ missions, category, onClose }: MissionReelProps) {
    const slides = missions;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMusicPlaying, setIsMusicPlaying] = useState(true);
    const audioRef = useRef<HTMLAudioElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const SLIDE_DURATION = 5000;

    // Determine content type of current slide
    const currentSlide = slides[currentIndex];
    // Based on HistoryDetail.tsx findings:
    // proof_type = 'video' | 'image' | 'audio' | null (text only)
    // image_url serves as the URL for video/audio/image
    const hasVideo = currentSlide?.proof_type === 'video' && !!currentSlide.image_url;
    const hasImage = currentSlide?.proof_type === 'image' && !!currentSlide.image_url;
    // content = Mission Prompt
    // proof_text = User's written text
    const missionTitle = currentSlide?.content || "Daily Mission";
    const userComment = currentSlide?.proof_text || currentSlide?.comment || "Mission Completed";

    // --- Effects ---

    // 1. Auto-Advance Slide
    useEffect(() => {
        if (slides.length === 0) return;

        // If video is playing, we might NOT want to auto-advance strictly at 5s? 
        // User didn't specify, but usually video length varies.
        // For now, keeping 5s or maybe longer for video? Let's stick to simple 5s to keep flow unless video is long. 
        // Better: Pausing auto-advance while video plays?
        // Let's keep it simple: Auto-advance always active for now.
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                nextSlide();
            }, SLIDE_DURATION);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [currentIndex, isPlaying, slides.length]);

    // 2. Audio Control (BGM vs Video Audio)
    useEffect(() => {
        if (!audioRef.current) return;

        if (hasVideo) {
            // Video active: Pause BGM
            audioRef.current.pause();
        } else {
            // Non-video: Play BGM if global music switch is ON
            if (isMusicPlaying) {
                audioRef.current.play().catch(err => console.log("Audio play failed:", err));
            } else {
                audioRef.current.pause();
            }
        }
    }, [currentIndex, isMusicPlaying, hasVideo, category]);
    // ^ Trigger on currentIndex change to check hasVideo for new slide

    // --- Helpers ---

    const nextSlide = () => {
        setCurrentIndex(prev => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
    };

    if (slides.length === 0) return null;

    const musicSrc = MUSIC_MAP[category] || '/bgm_reel.mp3';
    const bgGradient = GRADIENT_MAP[category] || 'from-slate-700 to-slate-900';

    // Ken Burns Animation Variants
    const kenBurnsVariants = {
        initial: { scale: 1.0, opacity: 0 },
        animate: {
            scale: 1.15,
            opacity: 1,
            transition: {
                scale: { duration: SLIDE_DURATION / 1000 + 1, ease: "linear" as const },
                opacity: { duration: 1 }
            }
        },
        exit: { opacity: 0, transition: { duration: 1 } }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
            {/* Audio Element */}
            <audio
                ref={audioRef}
                src={musicSrc}
                loop
                onEnded={() => setIsMusicPlaying(false)}
            />

            {/* Main Stage */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide.id}
                        className="absolute inset-0 w-full h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                    >
                        {/* 1. VIDEO SLIDE */}
                        {hasVideo ? (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <video
                                    src={currentSlide.image_url} // URL is in image_url column
                                    className="max-w-full max-h-full object-contain"
                                    autoPlay
                                    // NO muted attribute, so sound plays
                                    playsInline
                                // Optional: onEnded={nextSlide} to sync?
                                />
                            </div>
                        ) : hasImage ? (
                            /* 2. IMAGE SLIDE (Ken Burns) */
                            <div className="w-full h-full relative">
                                {/* Blurred BG */}
                                <div className="absolute inset-0 bg-black">
                                    <motion.img
                                        src={currentSlide.image_url}
                                        className="w-full h-full object-cover opacity-30 blur-2xl scale-125"
                                    />
                                </div>
                                {/* Ken Burns FG */}
                                <div className="absolute inset-0 flex items-center justify-center p-4">
                                    <motion.img
                                        variants={kenBurnsVariants}
                                        src={currentSlide.image_url}
                                        initial="initial"
                                        animate="animate"
                                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* 3. TEXT CARD SLIDE */
                            <div className={`w-full h-full flex items-center justify-center p-5 sm:p-8 bg-gradient-to-br ${bgGradient}`}>
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="max-w-xl text-center w-full px-2"
                                >
                                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white/90 mb-4 sm:mb-6 uppercase tracking-wider border-b border-white/20 pb-2.5 inline-block max-w-full break-keep">
                                        {missionTitle}
                                    </h3>

                                    <div className="relative my-2">
                                        <Quote size={32} className="absolute -top-4 -left-2 sm:-top-6 sm:-left-6 text-white/20" />
                                        <p className="text-xl sm:text-3xl md:text-4xl font-bold text-white leading-snug sm:leading-tight font-serif italic shadow-black drop-shadow-sm px-3 sm:px-6 break-keep">
                                            "{userComment}"
                                        </p>
                                        <Quote size={32} className="absolute -bottom-4 -right-2 sm:-bottom-6 sm:-right-6 text-white/20 rotate-180" />
                                    </div>

                                    <p className="mt-8 sm:mt-12 text-white/60 text-xs sm:text-sm font-mono">
                                        {new Date(currentSlide.date).toLocaleDateString()}
                                    </p>
                                </motion.div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Caption Overlay - Show for Image AND Video */}
                {(hasImage || hasVideo) && (
                    <div className="absolute bottom-6 sm:bottom-10 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center">
                        <motion.div
                            key={currentSlide.id + "-caption"}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="max-w-md mx-auto px-2"
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-white/90 mb-1 uppercase tracking-wider break-keep line-clamp-2">
                                {missionTitle}
                            </h3>
                            <p className="text-base sm:text-xl font-serif italic text-white mb-1.5 break-keep line-clamp-2">
                                {userComment !== "Mission Completed" ? userComment : ""}
                            </p>
                            <p className="text-white/50 text-[10px] sm:text-xs">
                                {new Date(currentSlide.date).toLocaleDateString()}
                            </p>
                        </motion.div>
                    </div>
                )}
            </div>

            {/* Controls Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
                <button
                    onClick={onClose}
                    aria-label="보상 릴스 닫기"
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md text-white transition-all"
                >
                    <X size={24} />
                </button>

                <div className="flex gap-4">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        aria-label={isPlaying ? "일시정지" : "재생"}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md text-white transition-all"
                    >
                        {isPlaying ? <Pause size={24} /> : <PlayIcon size={24} />}
                    </button>
                    <button
                        onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                        aria-label={isMusicPlaying ? "음악 끄기" : "음악 켜기"}
                        className={`p-3 rounded-full backdrop-blur-md text-white transition-all ${isMusicPlaying ? 'bg-primary/50' : 'bg-white/10'}`}
                    >
                        {isMusicPlaying ? <Music size={24} className="animate-pulse" /> : <Music size={24} className="opacity-50" />}
                    </button>
                </div>
            </div>

            {/* Click Nav Areas */}
            <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-w-resize" onClick={(e) => { e.stopPropagation(); prevSlide(); }} />
            <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-e-resize" onClick={(e) => { e.stopPropagation(); nextSlide(); }} />
        </div>
    );
}
