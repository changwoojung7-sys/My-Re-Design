import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function Login() {
    const { t } = useLanguage();
    // Unified Form State
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    // Login Mode State
    const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone for Login

    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const { setUser } = useStore();
    const navigate = useNavigate();

    const [verifyCode, setVerifyCode] = useState('');
    const [showVerify, setShowVerify] = useState(false);

    // Reset forms when switching modes
    useEffect(() => {
        setEmail('');
        setPhone('');
        setPassword('');
        setLoginIdentifier('');
        setVerifyCode('');
        setShowVerify(false);
    }, [isSignUp]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Strict Email Login
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginIdentifier,
                password,
            });

            if (error) throw error;
            if (data.user) {
                await handleLoginSuccess(data.user);
            }

        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // A. If already showing verify, treat submit as Verify Action
            if (showVerify) {
                await handleVerifySignUp();
                return;
            }

            // 1. Check Duplicates First
            // Format Phone
            let formattedPhone = phone.replace(/[^0-9]/g, '');
            if (formattedPhone.startsWith('010')) {
                formattedPhone = '+82' + formattedPhone.substring(1);
            }

            const { data: checks, error: checkError } = await supabase.rpc('check_duplicate_user', {
                email_input: email,
                phone_input: formattedPhone
            });

            if (checkError) throw checkError;
            if (checks) {
                // Handle Zombie Accounts (Deleted but left in Auth)
                if (checks.email_is_zombie || checks.phone_is_zombie) {
                    console.log("Zombie account detected. Cleaning up...");
                    const { error: cleanError } = await supabase.rpc('clean_zombie_user', {
                        target_email: checks.email_is_zombie ? email : null,
                        target_phone: checks.phone_is_zombie ? formattedPhone : null
                    });
                    if (cleanError) console.error("Failed to clean zombie:", cleanError);
                } else {
                    // Real Duplicates
                    if (checks.email_exists) throw new Error("Email already registered.");
                    if (checks.phone_exists) throw new Error("Phone number already registered.");
                }
            }

            // 2. Sign Up (Email Verify)
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        phone: formattedPhone, // Save to metadata
                    }
                }
            });

            if (error) throw error;

            // 3. Switch to Verify Mode
            alert("Signup successful! Verification code sent to your email.");
            setShowVerify(true);

        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySignUp = async () => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: verifyCode,
                type: 'signup'
            });

            if (error) throw error;

            alert("Verification successful!");
            if (data.user) {
                await handleLoginSuccess(data.user);
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Verification failed");
            // Don't modify loading here as it's handled in wrapper
            throw err;
        }
    };

    const handleLoginSuccess = async (authUser: any) => {
        // Fetch Profile Data
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        // Determine nickname (profile > metadata > truncated email/phone)
        let nickname = profile?.nickname;
        if (!nickname) {
            if (authUser.phone) nickname = authUser.phone.slice(-4);
            else if (authUser.email) nickname = authUser.email.split('@')[0];
            else nickname = 'User';
        }

        setUser({
            id: authUser.id,
            email: authUser.email || authUser.phone || '',
            nickname: nickname,
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

                    <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">

                        {/* Validation Note */}
                        {isSignUp && !showVerify && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-blue-200 text-center">
                                    Email verification is required for signup.
                                </p>
                            </div>
                        )}

                        {isSignUp ? (
                            showVerify ? (
                                // Verify Step UI
                                <div className="space-y-4">
                                    <div className="text-center mb-4">
                                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                                            <Mail size={24} />
                                        </div>
                                        <h3 className="text-white font-bold text-lg">{t.verifyIdentity}</h3>
                                        <p className="text-sm text-slate-400">Enter the code sent to {email}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.verifyCode}</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="123456"
                                                value={verifyCode}
                                                onChange={(e) => setVerifyCode(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors text-center text-xl tracking-widest"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Sign Up Form UI
                                <>
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.email}</label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                placeholder="user@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                                required
                                            />
                                            <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.phone}</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                placeholder="010-1234-5678"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                                required
                                            />
                                            <Phone className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                        </div>
                                    </div>
                                    {/* Password Field */}
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
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
                                    </motion.div>
                                </>
                            )
                        ) : (
                            /* Login Mode: Single Identifier (EMAIL ONLY) */
                            // ... (Existing Login UI, reusing to ensure we don't break it)
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.email}</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        placeholder="user@email.com"
                                        value={loginIdentifier}
                                        onChange={(e) => setLoginIdentifier(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                        required
                                    />
                                    <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                </div>
                                {/* Password Field (Login) */}
                                <div className="mt-4">
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
                            </div>
                        )}


                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (t.generating || 'Processing...') : (
                                isSignUp
                                    ? (showVerify ? t.verifyAuth : t.createAccount)
                                    : t.login
                            )}
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
