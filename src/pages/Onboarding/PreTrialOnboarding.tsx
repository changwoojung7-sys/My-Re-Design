import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useStore } from '../../lib/store';

export default function PreTrialOnboarding() {
    const navigate = useNavigate();
    const { setUser } = useStore();
    const [step, setStep] = useState(0);
    const [goalText, setGoalText] = useState('');
    const [loading, setLoading] = useState(false);

    // 하드코딩된 예시 미션
    const demoMissions = [
        "10분 스트레칭 하기",
        "명상 앱 켜고 심호흡하기",
        "오늘 하루 마신 물 기록하기"
    ];

    const handleGenerate = () => {
        if (!goalText.trim()) {
            alert("목표를 입력해주세요.");
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setStep(1);
        }, 1500);
    };

    const handleStart = () => {
        // 임시 데이터 저장
        localStorage.setItem('preTrialData', JSON.stringify({
            goal: goalText,
            category: 'body_wellness' // 기본 카테고리
        }));
        
        // 게스트 유저로 자동 로그인 및 온보딩으로 이동
        setUser({ id: 'demo123', email: 'demo@coreloop.com', nickname: 'DemoUser', routine_dna: null });
        navigate('/onboarding');
    };

    return (
        <div className="w-full h-full p-6 flex flex-col items-center justify-center relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black">
            <div className="w-full max-w-md relative z-10">
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div
                            key="step0"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 w-full text-center"
                        >
                            <div className="flex justify-center mb-4">
                                <img src="/reme_icon.png" alt="Icon" className="w-16 h-16 rounded-[1.8rem] shadow-lg shadow-primary/30" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">어떤 습관을 만들고 싶으신가요?</h2>
                            <p className="text-sm text-slate-400 mb-6">간단한 목표를 입력하면 AI가 맞춤형 미션을 만들어드려요.</p>
                            
                            <input
                                type="text"
                                placeholder="예: 매일 물 2리터 마시기"
                                value={goalText}
                                onChange={(e) => setGoalText(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white focus:border-primary focus:outline-none placeholder:text-slate-500 mb-4"
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            />
                            
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-primary to-accent text-black font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition disabled:opacity-50"
                            >
                                {loading ? "루틴 생성 중..." : "AI 루틴 만들기"}
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="mt-4 text-sm text-slate-500 hover:text-white"
                            >
                                이미 계정이 있으신가요?
                            </button>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 w-full text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">미션 예제 미리보기</h2>
                            <p className="text-sm text-slate-400 mb-6">[{goalText}] 달성을 위한 '건강한 몸 만들기' 미션 예제입니다.</p>

                            <div className="space-y-3 mb-8 text-left">
                                {demoMissions.map((m, i) => (
                                    <div key={i} className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                            {i + 1}
                                        </div>
                                        <span className="text-white text-sm">{m}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleStart}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent text-black font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition"
                            >
                                이 루틴으로 시작하기 <ArrowRight size={18} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
