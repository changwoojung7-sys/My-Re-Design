import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function ResetPassword() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Ensure we have a session (the link usually logs the user in) or recover token


    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: t.passwordMismatch });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: "Password must be at least 6 characters." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setMessage({ type: 'success', text: t.passwordUpdated });
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "Failed to update password." });
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
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary shadow-lg shadow-primary/20">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {t.resetPassword}
                    </h1>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
                    {message && (
                        <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${message.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/20 text-green-200'
                            : 'bg-red-500/10 border border-red-500/20 text-red-200'
                            }`}>
                            {message.type === 'success' ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                            <p className="text-sm font-medium">{message.text}</p>
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1.5 ml-1 uppercase tracking-wider">{t.newPassword}</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-all focus:ring-1 focus:ring-primary/50"
                                    required
                                />
                                <Lock className="absolute right-4 top-3.5 text-slate-500" size={18} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1.5 ml-1 uppercase tracking-wider">{t.confirmPassword}</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-all focus:ring-1 focus:ring-primary/50"
                                    required
                                />
                                <Lock className="absolute right-4 top-3.5 text-slate-500" size={18} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (t.generating || 'Processing...') : t.updatePassword}
                            {!loading && <ArrowRight size={20} />}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
