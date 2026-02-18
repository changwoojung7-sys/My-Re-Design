import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import SupportModal from '../../components/layout/SupportModal';

// PortOne Type Definition (Minimal)
import { processPaymentSuccess, checkMobilePaymentResult } from '../../lib/payment';

declare global {
    interface Window {
        IMP: any;
        PortOne: any;
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

    // Check for Mobile Payment Redirect Result on Mount
    useEffect(() => {
        const checkMobileResult = async () => {
            const result = await checkMobilePaymentResult();
            if (result) {
                if (result.success) {
                    alert(t.subscriptionSuccessful || 'Payment Successful!');
                    window.location.reload();
                } else {
                    alert(`Payment Failed: ${result.error}`);
                }
            }
        };
        checkMobileResult();
    }, []);

    const plans = [
        { id: '1m', name: t.plan1Month, price: t.price1Month, amount: 3000, save: '24%' },
        { id: '3m', name: t.plan3Months, price: t.price3Months, amount: 7500, save: '37%' },
        { id: '6m', name: t.plan6Months, price: t.price6Months, amount: 12000, save: '50%' },
        { id: '12m', name: t.plan12Months, price: t.price12Months, amount: 18000, save: '62%', best: true },
    ];

    const handleSubscribe = async (plan: typeof plans[0]) => {
        if (!window.IMP) return;
        const { IMP } = window;

        // Fetch Payment Mode
        const { data: payModeData } = await supabase.from('admin_settings').select('value').eq('key', 'payment_mode').single();
        const mode = payModeData?.value || 'test'; // Default to test

        // Initialize PortOne (User Code for V1, or just proceed for V2 check)
        // If mode is real, we use V2 logic which doesn't need IMP.init traditionally unless hybrid?
        // But let's init anyway for V1 fallback or consistency
        if (mode !== 'real') {
            IMP.init('imp05646567'); // User's Identification Code (V1 Test)
        }

        // Save state for Mobile Redirect
        const monthsToAdd = parseInt(plan.id.replace('m', ''));
        const startDate = new Date();

        const saveState = {
            mode,
            tier: { months: monthsToAdd, price: plan.amount, label: plan.name },
            planType: 'all',
            targetCategory: null,
            startDate: startDate.toISOString(),
            endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + monthsToAdd)).toISOString()
        };
        localStorage.setItem('pending_payment', JSON.stringify(saveState));

        if (mode === 'real') {
            // --- PortOne V2 (Real) ---
            if (!window.PortOne) {
                alert("PortOne V2 SDK Loading...");
                return;
            }

            // PortOne V2 Store ID and Channel Key (Real) -> Copied from SubscriptionManager
            const PORTONE_V2_STORE_ID = 'store-25bcb4a5-4d9e-440e-9aea-b20559181588';
            const PORTONE_V2_CHANNEL_KEY = 'channel-key-eeaefe66-b5b0-4d67-a320-bb6a8e6ad7dd';

            const paymentId = `pay_${new Date().getTime()}`;

            try {
                const response = await window.PortOne.requestPayment({
                    storeId: PORTONE_V2_STORE_ID,
                    channelKey: PORTONE_V2_CHANNEL_KEY,
                    paymentId: paymentId,
                    orderName: `MyReDesign Premium - ${plan.name}`,
                    totalAmount: plan.amount,
                    currency: "CURRENCY_KRW",
                    payMethod: "CARD",
                    customer: {
                        fullName: user?.nickname || 'Guest',
                        phoneNumber: user?.phone || '010-0000-0000',
                        email: user?.email,
                    },
                    redirectUrl: window.location.href, // Required for Mobile V2
                });

                if (response.code != null) {
                    alert(`Payment Failed: ${response.message}`);
                    return;
                }

                // Success
                const result = await processPaymentSuccess(
                    response.paymentId,
                    mode,
                    { months: parseInt(plan.id.replace('m', '')), price: plan.amount, label: plan.name },
                    'all',
                    null,
                    new Date(),
                    new Date(new Date().setMonth(new Date().getMonth() + parseInt(plan.id.replace('m', '')))),
                    undefined
                );

                if (result.success) {
                    localStorage.removeItem('pending_payment');
                    alert(t.subscriptionSuccessful || 'Payment Successful! Premium activated.');
                    window.location.reload();
                } else {
                    alert(`Payment processed but failed to save: ${result.error}`);
                }

            } catch (e: any) {
                console.error("Payment Request Error:", e);
                alert(`Payment Request Failed: ${e.message}`);
            }

        } else {
            // --- PortOne V1 (Test) ---
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
                    // Success - Use centralized handler
                    const result = await processPaymentSuccess(
                        rsp.imp_uid,
                        mode,
                        // Convert Paywall plan to PaymentTier structure
                        { months: parseInt(plan.id.replace('m', '')), price: plan.amount, label: plan.name },
                        'all', // Paywall is always All Access
                        null,
                        new Date(), // Start Now
                        new Date(new Date().setMonth(new Date().getMonth() + parseInt(plan.id.replace('m', '')))), // End Date
                        rsp.merchant_uid
                    );

                    if (result.success) {
                        alert(t.subscriptionSuccessful || 'Payment Successful! Premium activated.');
                        window.location.reload();
                    } else {
                        alert(`Payment processed but failed to save: ${result.error}`);
                    }
                } else {
                    localStorage.removeItem('pending_payment');
                    alert(`Payment Failed: ${rsp.error_msg}`);
                }
            });
        }
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
                        <p>상호 : 유진에이아이(YujinAI) | 대표자명 : 정창우</p>
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
