import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, ArrowRight, User } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import SupportModal from '../../components/layout/SupportModal';

export default function Login() {
    const { t } = useLanguage();
    // Unified Form State
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [nickname, setNickname] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    const emailRef = useRef<HTMLInputElement>(null);

    // Login Mode State
    const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone for Login

    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const { setUser } = useStore();
    const navigate = useNavigate();

    const [verifyCode, setVerifyCode] = useState('');
    const [showVerify, setShowVerify] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showResetVerify, setShowResetVerify] = useState(false);

    // Support Modal State
    const [supportModalState, setSupportModalState] = useState<{
        isOpen: boolean;
        view: 'main' | 'terms' | 'privacy' | 'refund';
    }>({ isOpen: false, view: 'main' });

    const openSupportModal = (view: 'main' | 'terms' | 'privacy' | 'refund' = 'main') => {
        setSupportModalState({ isOpen: true, view });
    };

    // Reset forms when switching modes
    useEffect(() => {
        setEmail('');
        setPhone('');
        setPassword('');
        setFullName('');
        setNickname('');
        setLoginIdentifier('');
        setVerifyCode('');
        setShowVerify(false);
        setShowForgotPassword(false);
        setShowResetVerify(false);

        if (isSignUp) {
            setTimeout(() => emailRef.current?.focus(), 100);
        }
    }, [isSignUp]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Strict Email Login
            // SPECIAL: Reviewer Bypass (No verification needed for this specific email)
            if (loginIdentifier === 'reviewer@coreloop.com') {
                // Mock Success for Reviewer
                // We mock the user object structure expected by handleLoginSuccess
                const mockReviewerUser = {
                    id: 'reviewer-id-global',
                    email: 'reviewer@coreloop.com',
                    phone: '',
                    // We don't have metadata here, but handleLoginSuccess handles missing fields
                };
                await handleLoginSuccess(mockReviewerUser);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginIdentifier,
                password,
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error(t.invalidCredentials);
                }
                throw error;
            }

            if (data.user) {
                await handleLoginSuccess(data.user);
            }

        } catch (err: any) {
            console.error(err);
            if (err.message === "Invalid login credentials") {
                alert(t.invalidCredentials);
            } else {
                alert(err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginIdentifier.trim()) {
            alert(t.enterEmailForReset);
            return;
        }
        setLoading(true);

        try {
            // Using OTP (One Time Code) / Email OTP for password reset flow
            const { error } = await supabase.auth.signInWithOtp({
                email: loginIdentifier,
                options: {
                    shouldCreateUser: false, // Ensure we don't create new users
                }
            });

            if (error) throw error;

            // Switch to verification mode for reset
            setShowResetVerify(true);
            setVerifyCode('');

        } catch (err: any) {
            console.error(err);
            alert(err.message || "Failed to send reset code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyResetCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Verify the email OTP (Magic Link code)
            const { error } = await supabase.auth.verifyOtp({
                email: loginIdentifier,
                token: verifyCode,
                type: 'email'
            });

            if (error) throw error;

            // If success, user is logged in. Redirect to Reset Password Page
            navigate('/reset-password');

        } catch (err: any) {
            console.error(err);
            alert(err.message || "Verification failed");
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

            // 1. Check Duplicates & Validation First
            if (!fullName.trim()) throw new Error("Name is required.");
            if (!phone.trim()) throw new Error("Phone number is required.");

            // Format Phone
            let formattedPhone = phone.replace(/[^0-9]/g, '');
            if (formattedPhone.length < 10) throw new Error("Please enter a valid phone number.");

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
                        full_name: fullName,
                        nickname: nickname || fullName, // Default nickname to name if empty
                        phone_number: formattedPhone, // Redundant but safe
                    }
                }
            });

            if (error) throw error;

            // 3. Switch to Verify Mode
            alert("Signup successful! Verification code sent to your email.");
            setShowVerify(true);
            setVerifyCode('');

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

    const [isResetMode, setIsResetMode] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const checkResetStatus = async () => {
        // Only check if we have a valid email and aren't in signup/forgot mode
        if (isSignUp || showForgotPassword || !loginIdentifier.includes('@')) return;

        try {
            const { data } = await supabase.rpc('check_user_reset_status', {
                email_input: loginIdentifier
            });
            if (data === true) {
                setIsResetMode(true);
            } else {
                setIsResetMode(false);
            }
        } catch (err) {
            console.error(err);
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
            custom_free_trial_days: profile?.custom_free_trial_days,
            full_name: profile?.full_name,
        });
        navigate('/');
    };

    const handleResetAndLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (newPassword !== confirmPassword) {
            alert(t.passwordMismatch || "Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            // Call the complete reset RPC
            const { error } = await supabase.rpc('complete_force_password_reset', {
                email_input: loginIdentifier,
                new_password: newPassword
            });

            if (error) throw error;

            alert("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인합니다.");

            // Auto Login with new password
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: loginIdentifier,
                password: newPassword,
            });

            if (loginError) throw loginError;
            if (data.user) await handleLoginSuccess(data.user);

        } catch (err: any) {
            console.error(err);
            alert(err.message || "Reset failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm relative"
            >
                {/* 1. Admin Login Button (Hidden/Subtle) */}
                <button
                    onClick={() => navigate('/admin')}
                    className="absolute -top-16 -left-4 text-white/5 hover:text-white/20 transition-colors p-2"
                >
                    <Lock size={16} />
                </button>
                <div className="mb-8 text-center">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/reme_logo.png"
                            alt="My Re Design Logo"
                            className="w-24 h-24 rounded-full shadow-lg shadow-primary/50 object-cover"
                        />
                    </div>
                    <h1 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {t.appTitle}
                    </h1>
                    <div className="space-y-1 mb-8">
                        <p className="text-white font-bold text-sm">
                            나를 기록하는 성장 브이로그 & 목표 챌린지
                        </p>
                        <p className="text-slate-400 text-xs">
                            사진, 영상, 음성 등 다양한 방식으로 기록하고 친구들과 공유하세요.
                        </p>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">

                    <form onSubmit={
                        isSignUp
                            ? (showVerify ? handleVerifySignUp : handleSignUp)
                            : (showForgotPassword
                                ? (showResetVerify ? handleVerifyResetCode : handleResetPassword)
                                : handleLogin)
                    } className="space-y-4">

                        {/* Validation Note */}
                        {isSignUp && !showVerify && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-blue-200 text-center">
                                    Email verification is required for signup.
                                </p>
                            </div>
                        )}

                        {/* Verify Step UI (Shared for SignUp Verify and Reset Verify) */}
                        {(showVerify || showResetVerify) ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <div className="text-center mb-4">
                                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                                        <Mail size={24} />
                                    </div>
                                    <h3 className="text-white font-bold text-lg">{t.verifyIdentity}</h3>
                                    <p className="text-sm text-slate-400">Enter the code sent to {isSignUp ? email : loginIdentifier}</p>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.enterCode}</label>
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
                            // Main Forms (Login, SignUp, Forgot Request)
                            <>
                                {showForgotPassword ? (
                                    // Forgot Password Request UI
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="text-center mb-4">
                                            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-2 text-accent">
                                                <Lock size={24} />
                                            </div>
                                            <h3 className="text-white font-bold text-lg">{t.resetPassword}</h3>
                                            <p className="text-sm text-slate-400">{t.enterEmailForReset}</p>
                                        </div>

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
                                        </div>
                                    </div>
                                ) : (
                                    // Login / SignUp Inputs
                                    <>
                                        <div>
                                            <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{isSignUp ? t.email : t.email}</label>
                                            <div className="relative">
                                                <input
                                                    ref={emailRef}
                                                    name="email"
                                                    type={isSignUp ? "email" : "text"} // Allow text for Login ID?
                                                    placeholder="user@email.com"
                                                    value={isSignUp ? email : loginIdentifier}
                                                    onChange={(e) => {
                                                        if (isSignUp) setEmail(e.target.value);
                                                        else {
                                                            setLoginIdentifier(e.target.value);
                                                            if (isResetMode) setIsResetMode(false); // Reset mode if they change email
                                                        }
                                                    }}
                                                    onBlur={!isSignUp ? checkResetStatus : undefined}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                                    required
                                                />
                                                <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                            </div>
                                        </div>

                                        {/* SignUp Extra Fields */}
                                        {isSignUp && (
                                            <>
                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.fullName} <span className="text-red-500">*</span></label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder={t.namePlaceholder}
                                                                value={fullName}
                                                                onChange={(e) => setFullName(e.target.value)}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                                                required
                                                            />
                                                            <User className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                                        </div>
                                                    </div>
                                                    <div className="flex-[1.2]">
                                                        <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.phone} <span className="text-red-500">*</span></label>
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
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-500 font-medium mb-1 ml-1 uppercase">{t.nickname} <span className="text-[10px] text-slate-600 lowercase ml-1">(optional)</span></label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder={t.nickname}
                                                            value={nickname}
                                                            onChange={(e) => setNickname(e.target.value)}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors pl-10"
                                                        />
                                                        <User className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Password Field or Reset Fields */}
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                            {isResetMode ? (
                                                <div className="space-y-4 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                                                    <div className="text-center mb-2">
                                                        <p className="text-sm text-yellow-500 font-bold">비밀번호 재설정 필요</p>
                                                        <p className="text-xs text-slate-400">관리자 요청에 의해 비밀번호를 재설정합니다.</p>
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="password"
                                                            placeholder="새 비밀번호"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent transition-colors"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="password"
                                                            placeholder="새 비밀번호 확인"
                                                            value={confirmPassword}
                                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent transition-colors"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="block text-xs text-slate-500 font-medium ml-1 uppercase">{t.password}</label>
                                                        {!isSignUp && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowForgotPassword(true)}
                                                                className="text-xs text-accent hover:underline"
                                                            >
                                                                {t.forgotPassword}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            name="password"
                                                            type="password"
                                                            placeholder="••••••••"
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
                                                            required
                                                        />
                                                        <Lock className="absolute right-4 top-3.5 text-slate-600" size={16} />
                                                    </div>
                                                </>
                                            )}
                                        </motion.div>
                                    </>
                                )}
                            </>
                        )}


                        <button
                            type="submit"
                            disabled={loading}
                            onClick={isResetMode ? handleResetAndLogin : undefined}
                            className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (t.generating || 'Processing...') : (
                                isResetMode
                                    ? "비밀번호 재설정 및 로그인"
                                    : isSignUp
                                        ? (showVerify ? t.verifyAuth : t.createAccount)
                                        : (showForgotPassword
                                            ? (showResetVerify ? t.verifyCode : t.sendVerifyCode)
                                            : t.login)
                            )}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    {/* Toggle Mode */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-400">
                            {showForgotPassword
                                ? <button onClick={() => setShowForgotPassword(false)} className="text-white hover:text-primary font-bold">{t.backToLogin}</button>
                                : (isSignUp ? t.login : t.noAccount)
                            }
                        </p>
                        {!showForgotPassword && (
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-sm font-bold text-white hover:text-primary transition-colors mt-1"
                            >
                                {isSignUp ? t.login : t.createAccount}
                            </button>
                        )}
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
                    {/* Footer Links */}
                    <div className="mt-8 pt-4 border-t border-dashed border-white/5 text-center">
                        <div className="flex justify-center gap-4 text-[10px] text-slate-500">
                            <button onClick={() => openSupportModal('main')} className="hover:text-white/80 transition-colors">{t.inquiry || '문의하기'}</button>
                            <span className="text-white/10">|</span>
                            <button onClick={() => openSupportModal('terms')} className="hover:text-white/80 transition-colors">{t.terms || '이용약관'}</button>
                            <span className="text-white/10">|</span>
                            <button onClick={() => openSupportModal('privacy')} className="hover:text-white/80 transition-colors">{t.privacy || '개인정보처리방침'}</button>
                            <span className="text-white/10">|</span>
                            <button onClick={() => openSupportModal('refund')} className="hover:text-white/80 transition-colors">{t.refundPolicy || '환불정책'}</button>
                        </div>
                    </div>
                </div>
            </motion.div >

            <SupportModal
                isOpen={supportModalState.isOpen}
                onClose={() => setSupportModalState({ ...supportModalState, isOpen: false })}
                initialView={supportModalState.view}
            />
        </div >
    );
}
