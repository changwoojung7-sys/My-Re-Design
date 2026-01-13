import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { generateMissions } from '../../lib/openai';
import { useLanguage } from '../../lib/i18n';

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, setUser } = useStore();
    const { t } = useLanguage();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        age: 25,
        gender: 'female',
        phoneNumber: '',
        goals: {
            health: '',
            growth: '',
            mindset: '',
            career: '',
            social: '',
            vitality: ''
        }
    });

    useEffect(() => {
        const fetchMeta = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.phone_number) {
                setFormData(prev => ({ ...prev, phoneNumber: user.user_metadata.phone_number }));
            }
        };
        fetchMeta();
    }, []);

    const updateGoal = (key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            goals: { ...prev.goals, [key]: value }
        }));
    };

    const nextStep = () => setStep((prev) => prev + 1);

    const finish = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Demo User Bypass
            if (user.id === 'demo123') {
                // Simulate network delay for effect
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Show alert as requested
                alert(t.demoLimit);

                // Update Local Store (already done by updateGoal/setFormData but good to ensure latest)
                const updatedUser = {
                    ...user,
                    age: formData.age,
                    gender: formData.gender,
                    goal_health: formData.goals.health,
                    goal_growth: formData.goals.growth,
                    goal_career: formData.goals.career,
                    goal_mindset: formData.goals.mindset,
                    goal_social: formData.goals.social,
                    goal_vitality: formData.goals.vitality,
                };
                setUser(updatedUser);

                // Skip Supabase and OpenAI for demo
                // Ideally, we might want to populate some dummy missions in store if we had a local mission store.
                // For now, navigating to Home is enough, standard 'MyPage' handles empty states or hardcoded demo data if needed.
                navigate('/');
                return;
            }

            // 1. Update Local Store
            const updatedUser = {
                ...user,
                age: formData.age,
                gender: formData.gender,
                goal_health: formData.goals.health,
                goal_growth: formData.goals.growth,
                goal_career: formData.goals.career,
                goal_mindset: formData.goals.mindset,
                goal_social: formData.goals.social,
                goal_vitality: formData.goals.vitality,
            };
            setUser(updatedUser);

            // 2. Save to Supabase
            const { error } = await supabase
                .from('profiles')
                .update({
                    age: formData.age,
                    gender: formData.gender,
                    goal_health: formData.goals.health,
                    goal_growth: formData.goals.growth,
                    goal_career: formData.goals.career,
                    goal_mindset: formData.goals.mindset,
                    goal_social: formData.goals.social,
                    goal_vitality: formData.goals.vitality,
                    phone_number: formData.phoneNumber,
                    updated_at: new Date()
                })
                .eq('id', user.id);

            if (error) throw error;

            // 3. Generate Initial Missions
            const missions = await generateMissions(updatedUser);
            // Save missions to DB
            const missionInserts = missions.map(m => ({
                user_id: user.id,
                content: m.content,
                category: m.category,
                date: (() => {
                    const d = new Date();
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    return d.toISOString().split('T')[0];
                })()
            }));

            await supabase.from('missions').insert(missionInserts);

            navigate('/');
        } catch (err) {
            console.error('Onboarding failed:', err);
            alert(t.alertSaveGoalFail || 'Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isDemo = user?.id === 'demo123';

    const steps = [
        // Step 0: Welcome
        <div key="step0" className="text-center space-y-6">
            <div className="flex justify-center mb-4">
                <img src="/reme_icon.png" alt="Icon" className="w-16 h-16 rounded-[1.8rem] shadow-lg shadow-primary/30 animate-pulse object-cover" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t.onboardingTitle}
            </h2>
            <p className="text-slate-400 whitespace-pre-line">{t.onboardingSubtitle}</p>
            <button onClick={nextStep} className="mt-8 bg-white text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform">
                {t.startDesign}
            </button>
        </div>,

        // Step 1: Basic Info
        <div key="step1" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">{t.step1Title}</h2>

            <div>
                <label className="block text-sm text-slate-400 mb-2">{t.age}: {formData.age}</label>
                <input
                    type="range" min="10" max="80" value={formData.age}
                    onChange={(e) => !isDemo && setFormData({ ...formData, age: Number(e.target.value) })}
                    disabled={isDemo}
                    className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">{t.gender}</label>
                <div className="flex gap-4">
                    {['male', 'female', 'other'].map((g) => (
                        <button
                            key={g}
                            onClick={() => !isDemo && setFormData({ ...formData, gender: g })}
                            disabled={isDemo}
                            className={`flex-1 py-3 rounded-xl border transition-all capitalized 
                                ${formData.gender === g ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-slate-500'}
                                ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {t[g as keyof typeof t]}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">{t.phone}</label>
                <input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={isDemo ? '010-1234-5678' : formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    disabled={isDemo}
                    className={`w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
            </div>

            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">{t.next}</button>
        </div>,

        // Step 2: Health & Growth
        <div key="step2" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">{t.step2Title}</h2>
            {isDemo && <p className="text-sm text-primary mb-2">* {t.demoLimit}</p>}

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-primary font-bold">{t.health}</label>
                    <input
                        type="text" placeholder={t.healthPlaceholder}
                        value={isDemo ? t.healthPlaceholder : formData.goals.health}
                        onChange={(e) => updateGoal('health', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
                <div>
                    <label className="text-sm text-accent font-bold">{t.growth}</label>
                    <input
                        type="text" placeholder={t.growthPlaceholder}
                        value={isDemo ? t.growthPlaceholder : formData.goals.growth}
                        onChange={(e) => updateGoal('growth', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">{t.next}</button>
        </div>,

        // Step 3: Mindset & Career
        <div key="step3" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">{t.step3Title}</h2>
            {isDemo && <p className="text-sm text-primary mb-2">* {t.demoLimit}</p>}

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-pink-500 font-bold">{t.mindset}</label>
                    <input
                        type="text" placeholder={t.mindsetPlaceholder}
                        value={isDemo ? t.mindsetPlaceholder : formData.goals.mindset}
                        onChange={(e) => updateGoal('mindset', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
                <div>
                    <label className="text-sm text-yellow-500 font-bold">{t.career}</label>
                    <input
                        type="text" placeholder={t.careerPlaceholder}
                        value={isDemo ? t.careerPlaceholder : formData.goals.career}
                        onChange={(e) => updateGoal('career', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">{t.next}</button>
        </div>,

        // Step 4: Social & Vitality
        <div key="step4" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">{t.step4Title}</h2>
            {isDemo && <p className="text-sm text-primary mb-2">* {t.demoLimit}</p>}

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-blue-400 font-bold">{t.social}</label>
                    <input
                        type="text" placeholder={t.socialPlaceholder}
                        value={isDemo ? t.socialPlaceholder : formData.goals.social}
                        onChange={(e) => updateGoal('social', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
                <div>
                    <label className="text-sm text-green-400 font-bold">{t.vitality}</label>
                    <input
                        type="text" placeholder={t.vitalityPlaceholder}
                        value={isDemo ? t.vitalityPlaceholder : formData.goals.vitality}
                        onChange={(e) => updateGoal('vitality', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-400 focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
            <button onClick={finish} disabled={loading} className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-xl mt-4">
                {loading ? t.creatingLoop : t.completeGenerate}
            </button>
        </div>
    ];

    return (
        <div className="w-full h-full p-6 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-md relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {steps[step]}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
