import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

// PortOne Type Definition (Minimal)
declare global {
    interface Window {
        IMP: any;
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PaywallProps {
    onClose?: () => void;
}

export default function Paywall({ onClose }: PaywallProps) {
    const { t } = useLanguage();
    const { user } = useStore();

    const plans = [
        { id: '1m', name: t.plan1Month, price: t.price1Month, amount: 8900, save: null },
        { id: '3m', name: t.plan3Months, price: t.price3Months, amount: 19900, save: '25%' },
        { id: '6m', name: t.plan6Months, price: t.price6Months, amount: 39900, save: '25%' },
        { id: '12m', name: t.plan12Months, price: t.price12Months, amount: 59900, save: '44%', best: true },
    ];

    const handleSubscribe = (plan: typeof plans[0]) => {
        if (!window.IMP) return;
        const { IMP } = window;

        // Initialize PortOne (User Code)
        // IMPORTANT: Replace 'imp00000000' with your actual Merchant ID from PortOne Dashboard
        IMP.init('imp00000000');

        IMP.request_pay({
            pg: 'html5_inicis', // PG Provider (e.g., kcp, toss, html5_inicis)
            pay_method: 'card',
            merchant_uid: `mid_${new Date().getTime()}`, // Unique Order ID
            name: `CoreLoop Premium - ${plan.name}`,
            amount: plan.amount,
            buyer_email: user?.email,
            buyer_name: user?.nickname,
            buyer_tel: '010-0000-0000', // Optional, can fetch from user profile if available
        }, async (rsp: any) => {
            if (rsp.success) {
                // Payment Success Logic
                try {
                    // 1. Log to payment_history
                    const { error: historyError } = await supabase.from('payment_history').insert({
                        user_id: user?.id,
                        merchant_uid: rsp.merchant_uid,
                        imp_uid: rsp.imp_uid,
                        plan_id: plan.id,
                        amount: rsp.paid_amount,
                        status: 'paid',
                        pay_method: rsp.pay_method
                    });
                    if (historyError) throw historyError;

                    // 2. Update Subscription Date
                    // Calculate new end date
                    let monthsToAdd = 1;
                    if (plan.id === '3m') monthsToAdd = 3;
                    if (plan.id === '6m') monthsToAdd = 6;
                    if (plan.id === '12m') monthsToAdd = 12;

                    // If already valid, extend from current end date. Else from now.
                    const currentEnd = user?.subscription_end_date ? new Date(user.subscription_end_date) : new Date();
                    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
                    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);

                    const newEndDate = baseDate.toISOString();

                    const { error: profileError } = await supabase.from('profiles').update({
                        subscription_tier: 'premium',
                        subscription_end_date: newEndDate
                    }).eq('id', user?.id);

                    if (profileError) throw profileError;

                    alert('Payment Successful! Premium activated.');
                    window.location.reload(); // Reload to refresh state
                } catch (err: any) {
                    console.error('Payment DB Error:', err);
                    alert(`Payment processed but failed to save: ${err.message}`);
                }
            } else {
                alert(`Payment Failed: ${rsp.error_msg}`);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

                <div className="relative text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t.paywallTitle}</h2>
                    <p className="text-sm text-slate-400">{t.freeTrialEnded}</p>
                    <p className="text-xs text-primary font-bold mt-1">{t.paywallSubtitle}</p>
                </div>

                <div className="space-y-3 mb-6">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => handleSubscribe(plan)}
                            className={`w-full relative flex items-center justify-between p-4 rounded-xl border transition-all ${plan.best ? 'bg-white/10 border-primary shadow-lg shadow-primary/10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                            {plan.best && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                    BEST VALUE
                                </div>
                            )}
                            <div className="text-left">
                                <p className="text-sm font-bold text-white">{plan.name}</p>
                                {plan.save && <p className="text-[10px] text-accent font-bold">{t.savePercent} {plan.save}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-white">{plan.price}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl font-bold text-sm text-slate-500 hover:text-white hover:bg-white/5 transition mb-2"
                >
                    {t.maybeLater}
                </button>

                <p className="text-[10px] text-center text-slate-500 mb-4">
                    {t.restorePurchase} • {t.terms} • {t.privacy}
                </p>

            </motion.div>
        </div>
    );
}
