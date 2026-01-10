import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, AlertCircle, Clock } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

interface SubscriptionManagerProps {
    onClose: () => void;
}

export default function SubscriptionManager({ onClose }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user } = useStore();
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchHistory();
        }
    }, [user]);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('payment_history')
            .select('*')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false });
        if (data) setHistory(data);
    };

    if (!user) return null;

    const isPremium = user.subscription_tier === 'premium';
    const expiryDate = user.subscription_end_date
        ? new Date(user.subscription_end_date).toLocaleDateString()
        : '-';

    const handleCancel = () => {
        if (window.confirm("Are you sure you want to cancel? This will stop future billing.")) {
            alert("Subscription Set to Cancel at end of period.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CreditCard className="text-primary" size={24} />
                        {t.manageSubscription}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                        <XIcon />
                    </button>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">{t.currentPlan}</p>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                {isPremium ? "Premium" : "Free Plan"}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isPremium ? 'border-primary text-primary' : 'border-slate-500 text-slate-500'}`}>
                                    {isPremium ? t.active : t.expired}
                                </span>
                            </h3>
                        </div>
                    </div>

                    {isPremium && (
                        <div className="flex items-center gap-3 text-sm text-slate-300 bg-black/20 p-3 rounded-xl mb-4">
                            <Calendar size={18} className="text-accent" />
                            <span>{t.expiresOn}: <span className="font-mono font-bold text-white">{expiryDate}</span></span>
                        </div>
                    )}

                    {isPremium ? (
                        <button
                            onClick={handleCancel}
                            className="w-full py-3 bg-red-500/10 text-red-500 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <AlertCircle size={16} />
                            {t.cancelSubscription}
                        </button>
                    ) : (
                        <div className="text-center p-2">
                            <p className="text-slate-400 text-xs">Upgrade to unlock all features.</p>
                        </div>
                    )}
                </div>

                {/* Payment History Section */}
                <div className="border-t border-white/10 pt-4">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        Payment History
                    </h3>
                    <div className="space-y-2">
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">No payment history found.</p>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="bg-white/5 p-3 rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-white">{item.plan_id.toUpperCase()} Plan</p>
                                        <p className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-primary">₩{item.amount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{item.status}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </motion.div>
        </div>
    );
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}
