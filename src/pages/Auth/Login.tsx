import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function Login() {
    const { t } = useLanguage();
    const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form States
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    // Optional Fields for Signup
    const [optionalPhone, setOptionalPhone] = useState('');
    const [optionalEmail, setOptionalEmail] = useState('');

    const { setUser } = useStore();
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let authEmail = '';
            let metaData: any = {};

            // 1. Prepare Credentials
            if (authMethod === 'email') {
                authEmail = email;
                if (isSignUp && optionalPhone) {
                    metaData.phone_number = optionalPhone.replace(/-/g, '');
                }
            } else {
                const cleanPhone = phone.replace(/-/g, '');
                if (!cleanPhone) throw new Error("Phone number is required");
                authEmail = `${cleanPhone}@phone.coreloop.com`;

                // Store phone in metadata for easy access later
                metaData.phone_number = cleanPhone;
                if (isSignUp && optionalEmail) {
                    metaData.real_email = optionalEmail;
                }
            }

            let error;
            if (isSignUp) {
                // --- Sign Up ---
                const { error: signUpError } = await supabase.auth.signUp({
                    email: authEmail,
                    password,
                    options: { data: metaData }
                });
                if (!signUpError) alert('Account created! Please sign in if not auto-redirected.');
                error = signUpError;
            } else {
                // --- Sign In ---
                const { data, error: signInError } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password,
                });

                if (data.user) {
                    // Fetch Profile Data
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    setUser({
                        id: data.user.id,
                        email: data.user.email!,
                        nickname: profile?.nickname || (authMethod === 'email' ? email.split('@')[0] : phone),
                        // Map flat columns
                        age: profile?.age,
                        gender: profile?.gender,
                        goal_health: profile?.goal_health,
                        goal_growth: profile?.goal_growth,
                        goal_career: profile?.goal_career,
                        goal_mindset: profile?.goal_mindset,
                        goal_social: profile?.goal_social,
                        goal_vitality: profile?.goal_vitality,
                        custom_free_trial_days: profile?.custom_free_trial_days,
                    });
                    navigate('/');
                }
                error = signInError;
            }

            if (error) alert(error.message);
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm"
            >
                <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {t.appTitle}
                </h1>
                <p className="text-slate-400 text-center mb-8">{t.appSubtitle}</p>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">

                    {/* Method Tabs */}
                    <div className="flex bg-black/20 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => setAuthMethod('phone')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${authMethod === 'phone' ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Phone size={16} /> {t.phone}
                        </button>
                        <button
                            onClick={() => setAuthMethod('email')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${authMethod === 'email' ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Mail size={16} /> {t.email}
                        </button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">

                        {/* Main Input based on Method */}
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{authMethod === 'email' ? t.email : t.phone}</label>
                            {authMethod === 'phone' ? (
                                <input
                                    type="tel"
                                    placeholder="010-1234-5678"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors font-mono"
                                    required
                                />
                            ) : (
                                <input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.password}</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                                <Lock className="absolute right-4 top-3.5 text-slate-600" size={16} />
                            </div>
                        </div>

                        {/* Optional Fields (Only for Sign Up) */}
                        {isSignUp && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2 overflow-hidden">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-accent">Optional</span>
                                        <span className="text-[10px] text-slate-500">Backup Info</span>
                                    </div>
                                    {authMethod === 'phone' ? (
                                        <input
                                            type="email"
                                            placeholder="Recovery Email (Optional)"
                                            value={optionalEmail}
                                            onChange={(e) => setOptionalEmail(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                                        />
                                    ) : (
                                        <input
                                            type="tel"
                                            placeholder="Phone Number (Optional)"
                                            value={optionalPhone}
                                            onChange={(e) => setOptionalPhone(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                                        />
                                    )}
                                </div>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (t.generating || 'Processing...') : (isSignUp ? t.createAccount : t.login)}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    {/* Toggle Mode */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-400">
                            {isSignUp ? t.login : t.noAccount}
                        </p>
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-bold text-white hover:text-primary transition-colors mt-1"
                        >
                            {isSignUp ? t.login : t.createAccount}
                        </button>
                    </div>

                    {/* Guest */}
                    <div className="text-center mt-8 pt-6 border-t border-white/10">
                        <button type="button" onClick={() => {
                            setUser({ id: 'demo123', email: 'demo@coreloop.com', nickname: 'DemoUser', routine_dna: null });
                            navigate('/onboarding');
                        }} className="text-xs text-slate-500 hover:text-primary underline">
                            {t.guestLogin}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
