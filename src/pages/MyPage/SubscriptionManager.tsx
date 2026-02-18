import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Clock, Check, X } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { GoalCategory } from './MyPage';
import SupportModal from '../../components/layout/SupportModal';

import { processPaymentSuccess, checkMobilePaymentResult } from '../../lib/payment';

declare global {
    interface Window {
        IMP: any;
        PortOne: any;
    }
}

interface SubscriptionManagerProps {
    onClose: () => void;
    initialCategory: GoalCategory;
}

type PlanType = 'mission' | 'all';

interface PricingTier {
    months: number;
    price: number;
    label: string;
}

const MISSION_PRICING: PricingTier[] = [
    { months: 1, price: 1000, label: '1 Month' },
    { months: 3, price: 2500, label: '3 Months' },
    { months: 6, price: 4500, label: '6 Months' },
    { months: 12, price: 7000, label: '12 Months' },
];

const ALL_ACCESS_PRICING: PricingTier[] = [
    { months: 1, price: 3000, label: '1 Month' },
    { months: 3, price: 7500, label: '3 Months' },
    { months: 6, price: 12000, label: '6 Months' },
    { months: 12, price: 18000, label: '12 Months' },
];

// Funplay removed from paid categories list
const CATEGORIES: GoalCategory[] = ['body_wellness', 'growth_career', 'mind_connection'];

export default function SubscriptionManager({ onClose, initialCategory }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user } = useStore();
    const [activeTab, setActiveTab] = useState<'mission' | 'all'>('mission');
    const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeSubs, setActiveSubs] = useState<any[]>([]);
    const hasAutoSelected = useRef(false);

    // Support Modal State
    const [supportModalState, setSupportModalState] = useState<{
        isOpen: boolean;
        view: 'main' | 'terms' | 'privacy' | 'refund';
    }>({ isOpen: false, view: 'main' });

    const openSupportModal = (view: 'main' | 'terms' | 'privacy' | 'refund' = 'main') => {
        setSupportModalState({ isOpen: true, view });
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;

        // Fetch Payments
        const { data: payData } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (payData) setHistory(payData);

        // Fetch Subscriptions (All active or future scheduled ones)
        // We need future ones too to calculate extension chains correctly
        const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['active', 'scheduled']) // Assuming 'scheduled' might be a status we use, or just 'active' with future dates
            .order('end_date', { ascending: false }); // Latest end date first

        // Note: Code above used .eq('status', 'active').gt('end_date', now). 
        // If we want to chain, we should just get everything that hasn't finished yet.
        if (subData) {
            // Robustness: Filter out any subscription that matches a 'cancelled' payment
            // This handles cases where subscription wasn't cancelled in DB properly.
            const validSubs = subData.filter(sub => {
                const cancelledPayment = payData?.find(p =>
                    p.status === 'cancelled' &&
                    p.coverage_start_date === sub.start_date &&
                    p.coverage_end_date === sub.end_date
                );
                return !cancelledPayment;
            });
            setActiveSubs(validSubs);

            // Smart Auto-Select: If default category (Health) has no sub, but another does, switch to it.
            // This prevents users confusing "Free" status when they have a paid plan elsewhere.
            // Only run ONCE per session to avoid overriding user interaction.
            if (validSubs.length > 0 && !hasAutoSelected.current) {
                // Check if we have coverage for the CURRENT active selection
                // Since we can't easily access current state inside async buffer efficiently without refs, 
                // we rely on the fact this runs on mount/user change where defaults are active.

                // Find if there is an 'all' plan
                const allPlan = validSubs.find(s => s.type === 'all');
                if (allPlan) {
                    setActiveTab('all');
                    hasAutoSelected.current = true;
                } else {
                    // Find a mission plan. 
                    // If we have multiple, maybe pick the one that is active/scheduled?
                    const missionPlan = validSubs.find(s => s.type === 'mission');
                    if (missionPlan && missionPlan.target_id) {
                        // Only switch if we assume the user hasn't explicitly selected something else yet (Mount logic)
                        // But since basic state is default, switching is helpful.
                        setSelectedCategory(missionPlan.target_id);
                        setActiveTab('mission');
                        hasAutoSelected.current = true;
                    }
                }
            }
        }
    };

    if (!user) return null;

    // Find the subscription that determines the 'current end date' for the requested type/target
    const getRelevantExistingSub = (planType: PlanType, targetCategory: string | null) => {
        // If buying 'All', only 'All' extends 'All'.
        // If buying 'Mission', 'All' OR 'Same Mission' extends it.

        // Filter subs that cover the target
        const coveringSubs = activeSubs.filter(s => {
            // Check expiry
            if (new Date(s.end_date) <= new Date()) return false;

            if (planType === 'all') {
                return s.type === 'all';
            } else {
                // Plan is mission
                if (s.type === 'all') return true; // All extension covers mission
                return s.type === 'mission' && s.target_id === targetCategory;
            }
        });

        // Return the one with the latest end date
        if (coveringSubs.length === 0) return null;
        return coveringSubs.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
    };

    const latestRelevantSub = getRelevantExistingSub(activeTab, activeTab === 'mission' ? selectedCategory : null);

    // Check if currently unlocked (for UI display)
    // This is strictly about "Right Now" access
    const isUnlockedNow = (() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Compare date only

        return activeSubs.some(s => {
            const sStart = new Date(s.start_date);
            sStart.setHours(0, 0, 0, 0);

            const sEnd = new Date(s.end_date);
            sEnd.setHours(23, 59, 59, 999); // Active until end of day

            if (sStart > now || sEnd < now) return false;

            if (s.type === 'all') return true;

            const targetMatch = s.target_id && s.target_id.toLowerCase() === selectedCategory.toLowerCase();
            return s.type === 'mission' && targetMatch;
        });
    })();

    // PortOne Scrips are now loaded in index.html exclusively
    // No dynamic loading here to prevent duplicates

    // Check for Mobile Payment Redirect Result on Mount
    useEffect(() => {
        const checkMobileResult = async () => {
            const result = await checkMobilePaymentResult();
            if (result) {
                if (result.success) {
                    alert(t.subscriptionSuccessful);
                    await fetchData();
                    // Optional: Clear strict mode query params using history.replaceState if desired
                } else {
                    alert(t.subscriptionFailed.replace('{error}', result.error || 'Unknown error'));
                }
                // Ensure loading is false (though it defaults to false on fresh load)
            }
        };
        checkMobileResult();
    }, []);

    const handleSubscribe = async (tier: PricingTier) => {
        if (!user) return;
        if (!window.IMP) {
            alert("Payment module loading...");
            return;
        }

        const { IMP } = window;

        // Fetch Payment Mode
        const { data: payModeData } = await supabase.from('admin_settings').select('value').eq('key', 'payment_mode').single();
        const mode = payModeData?.value || 'test'; // Default to test

        // Initialize PortOne
        // Note: For V1, we init with User Code.
        // Test User Code: imp05646567 (User's current test code)
        // Real User Code (V2/Channel): The user provided a Channel Key for V2.
        // If we are strictly V1, we need the Store ID (User Code) for the Real channel too.
        // Assuming 'imp05646567' IS the user's Store ID for everything, and Mode controls the payment flow (PG sandbox vs real).

        // HOWEVER, PortOne V2 usually doesn't use IMP.init() the same way or uses different keys.
        // Given user instructions: "Keep Test Payment for now".
        // We will maintain existing code for 'test'. 
        // For 'real', if using V1, we need the Store ID (User Code) for the Real channel too.
        // Let's assume User Code is static, but we might pass extra params if needed.

        // The user provided Channel Key: channel-key-... which suggests V2.
        // Integrating V2 requires a different SDK logic (PortOne.requestPayment).
        // Since we are using V1 (window.IMP), we can't easily use the Channel Key directly here without Migration.
        // PROPOSAL: Alert user if they try 'Real' mode without V2 migration, OR just log it.
        // For now, init with the known code.
        IMP.init('imp05646567');

        // Calculate Dates
        let startDate = new Date();
        let isExtension = false;

        if (latestRelevantSub && isUnlockedNow) {
            startDate = new Date(latestRelevantSub.end_date);
            isExtension = true;
        }

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + tier.months);

        // Confirm
        const targetLabel = activeTab === 'all' ? 'All Access' : selectedCategory.toUpperCase();
        let confirmMsg = t.subscribeConfirm
            .replace('{target}', targetLabel)
            .replace('{months}', String(tier.months))
            .replace('{price}', tier.price.toLocaleString());

        if (isExtension) {
            confirmMsg += `\n\n(Extends existing plan until ${startDate.toLocaleDateString()})`;
        }

        const confirmed = window.confirm(confirmMsg);
        if (!confirmed) return;

        setLoading(true);

        // Call PortOne Payment
        if (mode === 'real') {
            // --- PortOne V2 (Real) ---
            if (!window.PortOne) {
                alert("PortOne V2 SDK Loading...");
                setLoading(false);
                return;
            }

            // PortOne V2 Store ID and Channel Key (Real)
            const PORTONE_V2_STORE_ID = 'store-25bcb4a5-4d9e-440e-9aea-b20559181588';
            const PORTONE_V2_CHANNEL_KEY = 'channel-key-eeaefe66-b5b0-4d67-a320-bb6a8e6ad7dd';

            const paymentId = `pay_${new Date().getTime()}`;
            try {
                const response = await window.PortOne.requestPayment({
                    storeId: PORTONE_V2_STORE_ID,
                    channelKey: PORTONE_V2_CHANNEL_KEY,
                    paymentId: paymentId,
                    orderName: `MyReDesign Premium - ${targetLabel} (${tier.label})`,
                    totalAmount: tier.price,
                    currency: "CURRENCY_KRW",
                    payMethod: "CARD",
                    customer: {
                        fullName: user.nickname,
                        phoneNumber: user.phone || '010-0000-0000',
                        email: user.email,
                    },
                    redirectUrl: window.location.href, // Required for Mobile V2
                });

                if (response.code != null) {
                    // Error occurred (PortOne V2 returns code on error, or throws?)
                    // V2 logic: response is object. if code exists, it's error.
                    alert(`Payment Failed: ${response.message}`);
                    setLoading(false);
                    return;
                }

                // Success - Use centralized handler
                const result = await processPaymentSuccess(
                    response.paymentId,
                    mode,
                    tier,
                    activeTab,
                    activeTab === 'mission' ? selectedCategory : null,
                    startDate,
                    endDate,
                    undefined // merchant_uid might be in response
                );

                if (result.success) {
                    alert(t.subscriptionSuccessful);
                    await fetchData();
                } else {
                    alert(t.subscriptionFailed.replace('{error}', result.error || 'Unknown error'));
                }

            } catch (e: any) {
                console.error("Payment Request Error:", e);
                alert(`Payment Request Failed: ${e.message}`);
            } finally {
                setLoading(false);
            }
        } else {
            // --- PortOne V1 (Test/Classic) ---

            // Save state for Mobile Redirect (if it happens)
            // We need to save simplified state because dates won't survive JSON
            const saveState = {
                mode,
                tier,
                planType: activeTab,
                targetCategory: activeTab === 'mission' ? selectedCategory : null,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            };
            localStorage.setItem('pending_payment', JSON.stringify(saveState));

            IMP.request_pay({
                pg: 'html5_inicis', // PG Provider
                pay_method: 'card',
                merchant_uid: `mid_${new Date().getTime()}`, // Unique Order ID
                name: `MyReDesign Premium - ${targetLabel} (${tier.label})`,
                amount: tier.price,
                buyer_email: user.email,
                buyer_name: user.nickname,
                buyer_tel: user.phone || '010-0000-0000',
                m_redirect_url: window.location.href, // Returns here
            }, async (rsp: any) => {
                if (rsp.success) {
                    const result = await processPaymentSuccess(
                        rsp.imp_uid,
                        mode,
                        tier,
                        activeTab,
                        activeTab === 'mission' ? selectedCategory : null,
                        startDate,
                        endDate,
                        rsp.merchant_uid
                    );
                    if (result.success) {
                        localStorage.removeItem('pending_payment'); // Clear on success
                        alert(t.subscriptionSuccessful);
                        await fetchData();
                    } else {
                        alert(t.subscriptionFailed.replace('{error}', result.error || 'Unknown error'));
                    }
                } else {
                    // Only failure comes here in PC. Mobile redirect doesn't trigger this callback usually if redirected.
                    // But if it fails instantly (e.g. user cancel), it might.
                    localStorage.removeItem('pending_payment');
                    alert(`Payment Failed: ${rsp.error_msg}`);
                }
                setLoading(false);
            });
        }
    };

    const handleCancel = async (paymentId: string, createdAt: string, imp_uid?: string, merchant_uid?: string) => {
        const createdDate = new Date(createdAt);
        const today = new Date();

        // Check if created within allowed window (Today + Next Day)
        // Logic: Difference in days should be <= 1
        const diffTime = today.getTime() - createdDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);

        if (diffDays > 2) { // safe margin, strictly > 1 day but allow up to 48h window practically
            alert(t.onlyTodayCancel); // Message might need update to "Only cancelable within 24 hours" or similar, but keeping for now as permitted
            return;
        }

        if (!window.confirm(t.cancelConfirm)) return;

        setLoading(true);
        try {
            // Call Edge Function for Secure Cancellation
            const { data, error } = await supabase.functions.invoke('cancel-payment', {
                body: {
                    imp_uid: imp_uid, // Pass imp_uid if available
                    merchant_uid: merchant_uid, // Pass merchant_uid if available
                    payment_id: paymentId, // Optional, for logging/lookup
                    reason: 'User requested cancellation via Subscription Manager'
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert(t.cancelSuccess);
            await fetchData();
        } catch (error: any) {
            console.error('Cancel error:', error);
            alert('Failed to cancel: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
                >

                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <CreditCard className="text-primary" size={24} />
                            {t.manageSubscription}
                        </h2>
                        <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Compact Current Plan Status */}
                    <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-4 mb-6 border border-white/5 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t.currentStatusFor} <span className="text-primary">{selectedCategory.toUpperCase()}</span></p>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    {isUnlockedNow
                                        ? t.unlockedPremium
                                        : latestRelevantSub && new Date(latestRelevantSub.start_date) > new Date()
                                            ? <span className="text-yellow-400">Scheduled (Upcoming)</span>
                                            : t.freeRestricted}
                                    {isUnlockedNow && <Check size={16} className="text-green-500" />}
                                </h3>
                            </div>
                            {latestRelevantSub && (
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 block">
                                        {new Date(latestRelevantSub.start_date) > new Date() ? 'Starts On' : t.expires}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-white">
                                        {new Date(latestRelevantSub.start_date) > new Date()
                                            ? new Date(latestRelevantSub.start_date).toLocaleDateString()
                                            : new Date(latestRelevantSub.end_date).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        <div className="pb-20">
                            {/* Subscription Options Tabs */}
                            <div className="flex bg-black/40 p-1 rounded-xl mb-4">
                                <button
                                    onClick={() => setActiveTab('mission')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'mission' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {t.missionPlan}
                                </button>
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-accent text-black' : 'text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {t.allAccessPlan}
                                </button>
                            </div>

                            {/* Category Selector (Only for Mission Plan) */}
                            {activeTab === 'mission' && (
                                <div className="mb-6 px-1">
                                    <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Select Category for Plan</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`py-2 px-1 text-xs font-bold rounded-lg capitalize transition-all border ${selectedCategory === cat
                                                    ? 'bg-primary/20 border-primary text-white'
                                                    : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pricing Grid (Reverted to 2-cols) */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {(activeTab === 'mission' ? MISSION_PRICING : ALL_ACCESS_PRICING).map((tier) => {
                                    // Calculate Discount
                                    // Default/Base Monthly Value. If 'All', it's 4 categories * 1000 = 4000. If Mission, it's just 1000.

                                    // User Request: "Discount rate based on 1000 KRW/mission/month * 4 for All Plan"

                                    let discountPercent = 0;
                                    if (activeTab === 'all') {
                                        // 3 Paid Categories * 1000 KRW = 3000 KRW Base
                                        const referenceMonthly = 1000 * 3;
                                        const totalReferencePrice = referenceMonthly * tier.months;
                                        if (totalReferencePrice > tier.price) {
                                            discountPercent = Math.round((1 - (tier.price / totalReferencePrice)) * 100);
                                        }
                                    } else {
                                        // Mission Plan Discount (Standard Logic: compare to 1 mo * months)
                                        // 1 mo = 1000.
                                        const referenceMonthly = 1000;
                                        const totalReferencePrice = referenceMonthly * tier.months;
                                        if (totalReferencePrice > tier.price) {
                                            discountPercent = Math.round((1 - (tier.price / totalReferencePrice)) * 100);
                                        }
                                    }

                                    return (
                                        <div
                                            key={tier.months}
                                            className="p-3 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between group hover:border-primary/30 transition-all relative overflow-hidden"
                                        >
                                            {discountPercent > 0 && (
                                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                                    SAVE {discountPercent}%
                                                </div>
                                            )}
                                            <div className="mb-3">
                                                <p className="text-xs text-slate-400 font-bold mb-1">{tier.label}</p>
                                                <p className="text-lg font-bold text-white">₩{tier.price.toLocaleString()}</p>
                                            </div>
                                            <button
                                                onClick={() => handleSubscribe(tier)}
                                                disabled={loading}
                                                className="w-full bg-primary text-black text-xs font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                            >
                                                {t.purchase || "Purchase"}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            <p className="text-[10px] text-slate-500 text-center mb-6">
                                {activeTab === 'mission'
                                    ? t.unlocksMissionOnly.replace('{category}', selectedCategory.toUpperCase())
                                    : t.unlocksAllAccess}
                            </p>

                            <div className="border-t border-white/10 pt-4">
                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <Clock size={16} className="text-slate-400" />
                                    {t.paymentHistory}
                                </h3>
                                <div className="space-y-2">
                                    {history.length === 0 ? (
                                        <p className="text-xs text-slate-500 text-center py-4">{t.noPaymentHistory}</p>
                                    ) : (
                                        history.map((item) => {
                                            // Parse plan type string like "mission_1mo" or "all_12mo"
                                            const [type, durationStr] = item.plan_type.split('_');
                                            const durationNum = parseInt(durationStr); // e.g. 1, 3, 6, 12

                                            let planName = type === 'all' ? t.allAccessPlan : t.missionPlan;
                                            if (type === 'mission' && item.target_id) {
                                                // Translate category name if possible (using existing key in t)
                                                // t[item.target_id] relies on the category string matching the key exactly
                                                const translatedCat = (t as any)[item.target_id] || item.target_id;
                                                planName += ` (${translatedCat})`;
                                            }

                                            return (
                                                <div key={item.id} className="bg-white/5 p-3 rounded-xl flex justify-between items-center">
                                                    <div>
                                                        <p className={`text-xs font-bold mb-1 ${(item.status === 'cancelled' || !!item.cancelled_at) ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                            {planName}
                                                            <span className="text-[10px] text-slate-500 font-normal ml-2">
                                                                {t.paymentDate} : {(() => {
                                                                    const d = new Date(item.created_at);
                                                                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                                })()}
                                                            </span>
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            {(() => {
                                                                const startDate = new Date(item.coverage_start_date || item.created_at);
                                                                const endDate = item.coverage_end_date
                                                                    ? new Date(item.coverage_end_date)
                                                                    : new Date(startDate.getTime() + (durationNum * 30 * 24 * 60 * 60 * 1000)); // approx fallback

                                                                // Fix: Ensure fallback end date is roughly correct (add months) if not present
                                                                if (!item.coverage_end_date) {
                                                                    endDate.setTime(startDate.getTime()); // reset
                                                                    endDate.setMonth(endDate.getMonth() + durationNum);
                                                                }

                                                                return (
                                                                    <>
                                                                        <span>{startDate.toLocaleDateString()}</span>
                                                                        <span>-</span>
                                                                        <span>{endDate.toLocaleDateString()}</span>
                                                                        <span className="ml-1 text-primary">({durationNum}{durationNum > 1 ? t.months : t.month})</span>
                                                                    </>
                                                                );
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end gap-1">
                                                        {(item.status === 'cancelled' || !!item.cancelled_at) ? (
                                                            <>
                                                                <p className="text-xs font-bold text-red-500">{t.cancelled}</p>
                                                                <p className="text-[10px] text-slate-500">{new Date(item.cancelled_at || new Date()).toLocaleDateString()}</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-xs font-bold text-primary">₩{Number(item.amount).toLocaleString()}</p>
                                                                {(() => {
                                                                    const pDate = new Date(item.created_at);
                                                                    const now = new Date();
                                                                    const diff = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
                                                                    const canCancel = diff <= 2.0;

                                                                    return canCancel && (
                                                                        <button
                                                                            onClick={() => handleCancel(item.id, item.created_at, item.imp_uid, item.merchant_uid)}
                                                                            className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                                                        >
                                                                            {t.cancelPayment}
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Customer Support & Legal Footer */}
                            <div className="border-t border-white/10 pt-6 mt-6 pb-6 text-center">
                                <h3 className="text-sm font-bold text-white mb-2">{t.customerSupport}</h3>
                                <button
                                    onClick={() => openSupportModal('main')}
                                    className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors mb-4"
                                >
                                    {t.inquiry} (yujinit2005@gmail.com)
                                </button>

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
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Support Modal */}
            <SupportModal
                isOpen={supportModalState.isOpen}
                onClose={() => setSupportModalState({ ...supportModalState, isOpen: false })}
                initialView={supportModalState.view}
            />
        </>
    );
}
