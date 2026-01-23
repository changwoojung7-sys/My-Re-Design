import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import SupportModal from '../../components/layout/SupportModal';

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

    const [supportModalState, setSupportModalState] = useState<{ isOpen: boolean, view: 'main' | 'terms' | 'privacy' | 'refund' }>({
        isOpen: false,
        view: 'main'
    });

    const openSupportModal = (view: 'main' | 'terms' | 'privacy' | 'refund') => {
        setSupportModalState({ isOpen: true, view });
    };

    const plans = [
        { id: '1m', name: t.plan1Month, price: t.price1Month, amount: 4900, save: null },
        { id: '3m', name: t.plan3Months, price: t.price3Months, amount: 12900, save: '25%' },
        { id: '6m', name: t.plan6Months, price: t.price6Months, amount: 19900, save: '25%' },
        { id: '12m', name: t.plan12Months, price: t.price12Months, amount: 29900, save: '44%', best: true },
    ];

    const handleSubscribe = (plan: typeof plans[0]) => {
        if (!window.IMP) return;
        const { IMP } = window;

        // Initialize PortOne (User Code)
        IMP.init('imp05646567'); // User's Identification Code

        IMP.request_pay({
            pg: 'html5_inicis', // PG Provider
            pay_method: 'card', // Payment Method
            merchant_uid: `mid_${new Date().getTime()}`, // Unique Order ID
            name: `MyReDesign Premium - ${plan.name}`,
            amount: plan.amount,
            buyer_email: user?.email,
            buyer_name: user?.nickname,
            buyer_tel: user?.phone || '010-0000-0000', // Use user's phone if available
            m_redirect_url: window.location.href, // Redirect URL for mobile
        }, async (rsp: any) => {
            if (rsp.success) {
                // Payment Success Logic
                try {
                    // Verify Payment Server-Side
                    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
                        body: {
                            imp_uid: rsp.imp_uid,
                            merchant_uid: rsp.merchant_uid
                        }
                    });

                    if (verifyError) throw verifyError;
                    if (verifyData?.error) throw new Error(verifyData.error);

                    // Calculate Dates
                    const monthsToAdd = parseInt(plan.id.replace('m', ''));
                    const startDate = new Date();
                    const endDate = new Date(startDate);
                    endDate.setMonth(endDate.getMonth() + monthsToAdd);

                    // 1. Record Payment (Unified 'payments' table)
                    const { error: payError } = await supabase.from('payments').insert({
                        user_id: user?.id,
                        amount: plan.amount,
                        plan_type: `all_${monthsToAdd}mo`,
                        duration_months: monthsToAdd,
                        target_id: null, // Paywall is typically All Access
                        status: 'paid',
                        merchant_uid: rsp.merchant_uid,
                        imp_uid: rsp.imp_uid,
                        coverage_start_date: startDate.toISOString(),
                        coverage_end_date: endDate.toISOString()
                    });

                    if (payError) throw payError;

                    // 2. Create Subscription
                    const { error: subError } = await supabase.from('subscriptions').insert({
                        user_id: user?.id,
                        type: 'all',
                        target_id: null,
                        start_date: startDate.toISOString(),
                        end_date: endDate.toISOString(),
                        status: 'active'
                    });

                    if (subError) throw subError;

                    // 3. Update Profile (Optional - mainly to ensure 'premium' tier flag if column exists)
                    // Note: 'subscription_end_date' column might be missing in some schemas, so simplified.
                    const { error: profileError } = await supabase.from('profiles').update({
                        subscription_tier: 'premium'
                    }).eq('id', user?.id);

                    if (profileError) throw profileError;

                    alert(t.subscriptionSuccessful || 'Payment Successful! Premium activated.');
                    window.location.reload();
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

                {/* New Detailed Footer */}
                <div className="mt-0 text-center bg-black/20 p-4 rounded-2xl border border-white/5">
                    <div className="flex justify-center gap-3 text-[10px] text-slate-500 underline mb-2">
                        <button onClick={() => openSupportModal('main')} className="hover:text-white transition-colors">{t.inquiry}</button>
                        <button onClick={() => openSupportModal('terms')} className="hover:text-white transition-colors">{t.terms}</button>
                        <button onClick={() => openSupportModal('privacy')} className="hover:text-white transition-colors">{t.privacy}</button>
                        <button onClick={() => openSupportModal('refund')} className="hover:text-white transition-colors">{t.refundPolicy}</button>
                    </div>

                    <div className="text-[10px] text-slate-600 space-y-0.5">
                        <p>상호 : 유진IT | 대표자명 : 정창우</p>
                        <p>사업자등록번호 : 519-77-00622</p>
                        <p>My Re Design | 010-6614-4561</p>
                    </div>
                </div>

                {/* Support Modal Overlay */}
                <SupportModal
                    isOpen={supportModalState.isOpen}
                    onClose={() => setSupportModalState({ ...supportModalState, isOpen: false })}
                    initialView={supportModalState.view}
                />

            </motion.div>
        </div>
    );
}
