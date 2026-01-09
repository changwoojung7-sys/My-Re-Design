import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { generateMissions } from '../../lib/openai';

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, setUser } = useStore();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        age: 25,
        gender: 'female',
        phoneNumber: '',
        goals: {
            health: '',
            learning: '',
            achievement: '',
            self_esteem: '',
            other: ''
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
            // 1. Update Local Store
            const updatedUser = {
                ...user,
                age: formData.age,
                gender: formData.gender,
                goal_health: formData.goals.health,
                goal_learning: formData.goals.learning,
                goal_achievement: formData.goals.achievement,
                goal_self_esteem: formData.goals.self_esteem,
                goal_other: formData.goals.other,
            };
            setUser(updatedUser);

            // 2. Save to Supabase
            const { error } = await supabase
                .from('profiles')
                .update({
                    age: formData.age,
                    gender: formData.gender,
                    goal_health: formData.goals.health,
                    goal_learning: formData.goals.learning,
                    goal_achievement: formData.goals.achievement,
                    goal_self_esteem: formData.goals.self_esteem,
                    goal_other: formData.goals.other,
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
            alert('Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        // Step 0: Welcome
        <div key="step0" className="text-center space-y-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                CoreLoop Setup
            </h2>
            <p className="text-slate-400">Let's design your life loop.<br />Tell me about your goals.</p>
            <button onClick={nextStep} className="mt-8 bg-white text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform">
                Start Design
            </button>
        </div>,

        // Step 1: Basic Info
        <div key="step1" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">1. Who are you?</h2>

            <div>
                <label className="block text-sm text-slate-400 mb-2">Age: {formData.age}</label>
                <input
                    type="range" min="10" max="80" value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">Gender</label>
                <div className="flex gap-4">
                    {['male', 'female', 'other'].map((g) => (
                        <button
                            key={g}
                            onClick={() => setFormData({ ...formData, gender: g })}
                            className={`flex-1 py-3 rounded-xl border transition-all capitalized ${formData.gender === g ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-slate-500'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">Phone Number</label>
                <input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                />
            </div>

            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">Next</button>
        </div>,

        // Step 2: Goals (Health & Learning)
        <div key="step2" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">2. Core Goals</h2>

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-primary font-bold">Health Goal</label>
                    <input
                        type="text" placeholder="e.g. Lose 5kg, Run 10km"
                        value={formData.goals.health}
                        onChange={(e) => updateGoal('health', e.target.value)}
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                    />
                </div>
                <div>
                    <label className="text-sm text-accent font-bold">Learning Goal</label>
                    <input
                        type="text" placeholder="e.g. Read 1 book/month"
                        value={formData.goals.learning}
                        onChange={(e) => updateGoal('learning', e.target.value)}
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent focus:outline-none"
                    />
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">Next</button>
        </div>,

        // Step 3: Goals (Achievement & Self-Esteem)
        <div key="step3" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">3. Inner Growth</h2>

            <div className="space-y-4">
                <div>
                    <label className="text-sm text-yellow-500 font-bold">Achievement Goal</label>
                    <input
                        type="text" placeholder="e.g. Launch Side Project"
                        value={formData.goals.achievement}
                        onChange={(e) => updateGoal('achievement', e.target.value)}
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="text-sm text-pink-500 font-bold">Self-Esteem Goal</label>
                    <input
                        type="text" placeholder="e.g. Daily Affirmation"
                        value={formData.goals.self_esteem}
                        onChange={(e) => updateGoal('self_esteem', e.target.value)}
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:outline-none"
                    />
                </div>
            </div>
            <button onClick={nextStep} className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4">Next</button>
        </div>,

        // Step 4: Other Goals
        <div key="step4" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold">4. Anything else?</h2>

            <div>
                <label className="text-sm text-slate-400 font-bold">Other Goal (Optional)</label>
                <textarea
                    placeholder="Any other habits or goals..."
                    value={formData.goals.other}
                    onChange={(e) => updateGoal('other', e.target.value)}
                    className="w-full h-32 mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white focus:outline-none resize-none"
                />
            </div>
            <button onClick={finish} disabled={loading} className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-xl mt-4">
                {loading ? 'Creating Loop...' : 'Complete & Generate Missions'}
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
