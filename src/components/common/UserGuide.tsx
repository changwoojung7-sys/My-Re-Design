import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Settings, Bell, Trophy, Calendar, CheckCircle, Hand } from 'lucide-react';

interface UserGuideProps {
    onClose: () => void;
}

export default function UserGuide({ onClose }: UserGuideProps) {
    const [step, setStep] = useState(0);

    const slides = [
        // Slide 0: Welcome & Settings
        {
            title: "나만의 루틴을 시작해보세요",
            subtitle: "먼저, 설정을 확인해주세요!",
            content: (
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center animate-pulse">
                            <Settings size={40} className="text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black font-bold border-2 border-slate-900">
                            1
                        </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl text-sm text-center text-slate-200">
                        <p className="mb-2 font-bold text-white">상단 [설정] 아이콘을 눌러보세요.</p>
                        <p>닉네임, 나이, 성별을 입력하면<br />AI가 더 정확한 미션을 추천해줍니다.</p>
                    </div>
                </div>
            )
        },
        // Slide 1: Core Loop
        {
            title: "성공을 위한 3단계 루프",
            subtitle: "목표 설정부터 성장까지",
            content: (
                <div className="flex flex-col gap-4 w-full px-4">
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Calendar size={20} /></div>
                        <div className="text-left">
                            <p className="font-bold text-sm">1. 목표 설정 (My Loop)</p>
                            <p className="text-xs text-slate-400">원하는 성장 카테고리를 선택하세요.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg">
                        <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><CheckCircle size={20} /></div>
                        <div className="text-left">
                            <p className="font-bold text-sm">2. 오늘의 미션 (Today)</p>
                            <p className="text-xs text-slate-400">매일 제공되는 AI 미션을 수행하세요.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-lg">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><Trophy size={20} /></div>
                        <div className="text-left">
                            <p className="font-bold text-sm">3. 성장 기록 (Growth)</p>
                            <p className="text-xs text-slate-400">나의 변화를 데이터로 확인하세요.</p>
                        </div>
                    </div>
                </div>
            )
        },
        // Slide 2: Mission Setup (Animated Interaction)
        {
            title: "나만의 미션 설계하기",
            subtitle: "수정 모드로 목표를 입력하세요",
            content: (
                <div className="relative w-full px-8 py-4">
                    {/* Mockup Card */}
                    <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 relative overflow-hidden">
                        {/* Header Row */}
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-primary">건강 목표</span>

                            {/* Animated Button */}
                            <motion.div
                                animate={{
                                    backgroundColor: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.05)", "#10b981", "#10b981"],
                                    color: ["#10b981", "#10b981", "#000000", "#000000"]
                                }}
                                transition={{ duration: 4, times: [0, 0.3, 0.35, 1], repeat: Infinity, repeatDelay: 1 }}
                                className="px-2 py-1 rounded text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1"
                            >
                                <motion.span
                                    animate={{ display: ["inline", "inline", "none", "none"] }}
                                    transition={{ duration: 4, times: [0, 0.3, 0.35, 1], repeat: Infinity, repeatDelay: 1 }}
                                >
                                    조회모드
                                </motion.span>
                                <motion.span
                                    initial={{ display: "none" }}
                                    animate={{ display: ["none", "none", "inline", "inline"] }}
                                    transition={{ duration: 4, times: [0, 0.3, 0.35, 1], repeat: Infinity, repeatDelay: 1 }}
                                >
                                    수정모드
                                </motion.span>
                            </motion.div>
                        </div>

                        {/* Input Field Animation */}
                        <div className="space-y-2">
                            <div className="h-2 w-1/3 bg-slate-600/50 rounded" />
                            <motion.div
                                animate={{
                                    backgroundColor: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"]
                                }}
                                transition={{ duration: 4, repeat: Infinity, repeatDelay: 1 }}
                                className="h-8 w-full rounded border border-slate-600/50 flex items-center px-2"
                            >
                                <motion.span
                                    animate={{ opacity: [0.3, 0.3, 1, 1], width: ["0%", "0%", "60%", "60%"] }}
                                    transition={{ duration: 4, times: [0, 0.4, 0.6, 1], repeat: Infinity, repeatDelay: 1 }}
                                    className="text-[10px] text-white overflow-hidden whitespace-nowrap border-r border-primary"
                                >
                                    매일 30분 걷기
                                </motion.span>
                            </motion.div>
                        </div>

                        {/* Save Button Appearing */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: [0, 0, 1, 1], y: [10, 10, 0, 0] }}
                            transition={{ duration: 4, times: [0, 0.6, 0.7, 1], repeat: Infinity, repeatDelay: 1 }}
                            className="mt-4 bg-primary text-black text-[10px] font-bold py-2 rounded text-center"
                        >
                            설계 저장
                        </motion.div>

                        {/* Hand Cursor Animation */}
                        <motion.div
                            animate={{
                                top: ["15%", "15%", "85%", "85%"],
                                left: ["80%", "80%", "50%", "50%"],
                                scale: [1, 0.9, 1, 0.9],
                            }}
                            transition={{ duration: 4, times: [0, 0.3, 0.7, 0.9], repeat: Infinity, repeatDelay: 1 }}
                            className="absolute pointer-events-none drop-shadow-xl z-10"
                            style={{ top: "15%", left: "80%" }}
                        >
                            <Hand size={24} className="text-white fill-slate-900" />
                        </motion.div>
                    </div>

                    <div className="mt-4 text-center">
                        <p className="text-xs text-slate-300">
                            <span className="text-emerald-400 font-bold">[조회모드]</span> 버튼을 눌러 수정 모드로 전환하고<br />
                            나만의 목표를 입력해보세요.
                        </p>
                    </div>
                </div>
            )
        },
        // Slide 3: Mission History (Mosaic Animation)
        {
            title: "성공을 기록하세요",
            subtitle: "미션 인증 & Play Movie",
            content: (
                <div className="flex flex-col gap-4 w-full">
                    <div className="relative w-full h-[250px] rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 group">
                        {/* Background Layer: List View */}
                        <div className="absolute inset-0 bg-slate-900">
                            <img
                                src="/guide_history_list.png"
                                alt="History List"
                                className="w-full h-full object-cover opacity-80"
                            />
                            {/* Transition Overlay to Detail */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0, 1, 1] }}
                                transition={{ duration: 4, times: [0, 0.4, 0.5, 1], repeat: Infinity, repeatDelay: 1 }}
                                className="absolute inset-0 bg-slate-900 z-10"
                            >
                                <img
                                    src="/guide_history_detail.png"
                                    alt="History Detail"
                                    className="w-full h-full object-cover opacity-80"
                                />
                                {/* Mosaic/Blur Effects on Text Areas */}
                                <motion.div
                                    animate={{ backdropFilter: ["blur(4px)", "blur(0px)", "blur(4px)"] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute top-[20%] left-[5%] w-[90%] h-[10%] bg-white/5 rounded"
                                />
                                <motion.div
                                    animate={{ backdropFilter: ["blur(4px)", "blur(0px)", "blur(4px)"] }}
                                    transition={{ duration: 2, delay: 0.5, repeat: Infinity }}
                                    className="absolute top-[35%] left-[5%] w-[90%] h-[15%] bg-white/5 rounded"
                                />
                            </motion.div>

                            {/* Hand Click Animation on List Item */}
                            <motion.div
                                animate={{
                                    opacity: [1, 1, 0, 0],
                                    scale: [1, 0.9, 1, 0]
                                }}
                                transition={{ duration: 4, times: [0, 0.35, 0.4, 0.45], repeat: Infinity, repeatDelay: 1 }}
                                className="absolute top-[25%] left-[50%] -translate-x-1/2 z-20"
                            >
                                <Hand size={32} className="text-white fill-slate-900" />
                            </motion.div>
                        </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-300">
                            완료한 미션은 <span className="text-primary font-bold">Play Movie</span> 기능을 통해
                            <br />영상으로 생생하게 다시 볼 수 있습니다.
                        </p>
                    </div>
                </div>
            )
        },
        // Slide 4: Friends (Image Overlay Animation)
        {
            title: "함께 성장하는 즐거움",
            subtitle: "친구 검색 및 응원하기",
            content: (
                <div className="flex flex-col gap-4 w-full">
                    <div className="relative w-full h-[250px] rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 group">
                        {/* Background Image */}
                        <img
                            src="/guide_friends.png"
                            alt="Friends Guide"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500 blur-[1px] group-hover:blur-sm"
                        />

                        {/* Overlay: Focused Areas Sequence */}

                        {/* 1. Search Bar Focus */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 3, times: [0, 0.1, 0.9, 1], repeat: Infinity, repeatDelay: 9 }}
                            className="absolute top-[16%] left-[5%] w-[90%] h-[15%] border-2 border-yellow-400 rounded-lg bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-10 flex items-center justify-center"
                        >
                            <span className="bg-black/80 px-2 py-1 rounded text-xs font-bold text-yellow-400 backdrop-blur-md">친구 검색 (이메일, 번호, 닉네임)</span>
                        </motion.div>

                        {/* 2. Like & Comment Focus */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 3, times: [0, 0.1, 0.9, 1], delay: 3, repeat: Infinity, repeatDelay: 9 }}
                            className="absolute bottom-[28%] left-[4%] w-[25%] h-[10%] border-2 border-pink-500 rounded-lg bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.5)] z-10 flex items-center justify-center"
                        >
                            <span className="bg-black/80 px-2 py-1 rounded text-xs font-bold text-pink-500 backdrop-blur-md">응원하기</span>
                        </motion.div>

                        {/* 3. History View Request Focus */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 3, times: [0, 0.1, 0.9, 1], delay: 6, repeat: Infinity, repeatDelay: 9 }}
                            className="absolute bottom-[38%] right-[5%] w-[45%] h-[10%] border-2 border-primary rounded-lg bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10 flex items-center justify-center"
                        >
                            <span className="bg-black/80 px-2 py-1 rounded text-xs font-bold text-primary backdrop-blur-md">히스토리 보기 요청</span>
                        </motion.div>


                        {/* Animated Hand Cursor */}
                        <motion.div
                            animate={{
                                top: ["80%", "23%", "23%", "64%", "64%", "60%", "60%"],
                                left: ["90%", "50%", "50%", "15%", "15%", "70%", "70%"],
                                scale: [1, 1, 0.9, 1, 0.9, 1, 0.9],
                            }}
                            transition={{
                                duration: 12,
                                times: [0, 0.2, 0.25, 0.5, 0.55, 0.8, 0.85],
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="absolute z-50 drop-shadow-2xl"
                        >
                            <Hand size={32} className="text-white fill-slate-900 stroke-[1.5]" />

                            {/* Click Ripple Effect */}
                            <motion.div
                                animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }} // Simplified sync
                                className="absolute -top-2 -left-2 w-12 h-12 bg-white/50 rounded-full"
                            />
                        </motion.div>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-300">
                            이메일, 전화번호, 닉네임 <span className="text-yellow-400 font-bold">일부만 입력해도</span>
                            <br />친구를 쉽게 찾을 수 있습니다.
                        </p>
                    </div>
                </div>
            )
        },
        // Slide 3: Notifications
        {
            title: "놓치지 마세요!",
            subtitle: "알림을 통해 소통해요",
            content: (
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center">
                            <Bell size={40} className="text-white" />
                        </div>
                        <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                        <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900" />
                    </div>

                    <div className="bg-white/10 p-5 rounded-xl text-sm text-slate-200">
                        <p className="font-bold text-white text-lg mb-2">알림 확인</p>
                        <p className="leading-relaxed">
                            친구가 내 히스토리를 보고 싶어할 때<br />
                            <span className="text-yellow-400 font-bold">알림(종 모양)</span>이 울립니다.<br />
                            여기서 요청을 <span className="text-green-400 font-bold">승인</span>해줄 수 있어요.
                        </p>
                    </div>
                </div>
            )
        }
    ];

    const nextSlide = () => {
        if (step < slides.length - 1) {
            setStep(step + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        localStorage.setItem('has_seen_guide', 'true');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col min-h-[500px]"
            >
                {/* Close Button */}
                <button
                    onClick={handleComplete}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-10"
                >
                    <X size={24} />
                </button>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                    <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${((step + 1) / slides.length) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 pt-12 text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -50, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full flex flex-col items-center"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">{slides[step].title}</h2>
                            <p className="text-primary text-sm font-medium mb-8">{slides[step].subtitle}</p>

                            <div className="flex-1 flex items-center justify-center w-full">
                                {slides[step].content}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-slate-800/50 border-t border-slate-800">
                    <button
                        onClick={nextSlide}
                        className="w-full py-3.5 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                    >
                        {step === slides.length - 1 ? "시작하기" : "다음"}
                        <ChevronRight size={18} />
                    </button>

                    <div className="flex justify-center gap-2 mt-4">
                        {slides.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-slate-700'}`}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
