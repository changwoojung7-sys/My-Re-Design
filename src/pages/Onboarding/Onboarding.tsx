import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { generateMissions } from '../../lib/openai';
import { useLanguage } from '../../lib/i18n';


// Import newly defined categories from MyPage or define locally for now
// To match MyPage.tsx: 'body_wellness' | 'growth_career' | 'mind_connection' | 'funplay'

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
            body_wellness: '',
            growth_career: '',
            mind_connection: ''
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

    const updateGoal = (key: keyof typeof formData.goals, value: string) => {
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
                await new Promise(resolve => setTimeout(resolve, 1500));
                alert(t.demoLimit);
                navigate('/');
                return;
            }

            // 1. Update Profile (Base Info)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    age: formData.age,
                    gender: formData.gender,
                    phone_number: formData.phoneNumber,
                    updated_at: new Date()
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 2. Insert User Goals (New Table Structure)
            // First, clear existing goals to be safe (or upsert)
            await supabase.from('user_goals').delete().eq('user_id', user.id);

            const goalsToInsert = [
                {
                    user_id: user.id,
                    category: 'body_wellness',
                    target_text: formData.goals.body_wellness,
                    seq: 1,
                    details: { current_status: 'New User' }
                },
                {
                    user_id: user.id,
                    category: 'growth_career',
                    target_text: formData.goals.growth_career,
                    seq: 1,
                    details: { current_status: 'New User' }
                },
                {
                    user_id: user.id,
                    category: 'mind_connection',
                    target_text: formData.goals.mind_connection,
                    seq: 1,
                    details: { current_status: 'New User' }
                },
                // FunPlay Auto-Add
                {
                    user_id: user.id,
                    category: 'funplay',
                    target_text: 'Daily 30s Mission',
                    seq: 1,
                    details: { difficulty: 'easy', time_limit: 30, mood: 'fun' }
                }
            ];

            const { error: goalError } = await supabase.from('user_goals').insert(goalsToInsert);
            if (goalError) throw goalError;

            // 3. Generate Initial Missions
            // Passing user is enough, generation reads from DB (user_goals) now
            const missions = await generateMissions(user);

            // Save missions to DB
            if (missions.length > 0) {
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
            }

            // Update Local Store (Optional, just for immediate reflection if needed)
            setUser({ ...user, age: formData.age, gender: formData.gender });

            navigate('/');
        } catch (err: any) {
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
                            {t[g as keyof typeof t] || g}
                        </button>
                    ))}
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">{t.next}</button>
        </div>,

        // Step 2: Body & Wellness + Growth & Career
        <div key="step2" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">2. Connect Loop</h2>
            {isDemo && <p className="text-sm text-primary mb-2">* {t.demoLimit}</p>}

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-primary font-bold">{t.body_wellness || "Body & Wellness"}</label>
                    <input
                        type="text" placeholder={t.healthPlaceholder || "e.g. Lose 5kg, Run 10km"}
                        value={isDemo ? (t.healthPlaceholder || "") : formData.goals.body_wellness}
                        onChange={(e) => updateGoal('body_wellness', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
                <div>
                    <label className="text-sm text-accent font-bold">{t.growth_career || "Growth & Career"}</label>
                    <input
                        type="text" placeholder={t.growthPlaceholder || "e.g. Learn Python"}
                        value={isDemo ? (t.growthPlaceholder || "") : formData.goals.growth_career}
                        onChange={(e) => updateGoal('growth_career', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
                    />
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">{t.next}</button>
        </div>,

        // Step 3: Mind & Connection
        <div key="step3" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">3. Inner Loop</h2>
            {isDemo && <p className="text-sm text-primary mb-2">* {t.demoLimit}</p>}

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-pink-500 font-bold">{t.mind_connection || "Mind & Connection"}</label>
                    <input
                        type="text" placeholder={t.mindsetPlaceholder || "e.g. Daily Affirmation"}
                        value={isDemo ? (t.mindsetPlaceholder || "") : formData.goals.mind_connection}
                        onChange={(e) => updateGoal('mind_connection', e.target.value)}
                        disabled={isDemo}
                        className={`w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none ${isDemo ? 'italic text-slate-400 opacity-80 cursor-not-allowed' : ''}`}
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
