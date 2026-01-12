import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Clock, Check, X } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { GoalCategory } from './MyPage';
import SupportModal from '../../components/layout/SupportModal';

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
    { months: 1, price: 990, label: '1 Month' },
    { months: 3, price: 2500, label: '3 Months' },
    { months: 6, price: 3900, label: '6 Months' },
    { months: 12, price: 5900, label: '12 Months' },
];

const ALL_ACCESS_PRICING: PricingTier[] = [
    { months: 1, price: 4900, label: '1 Month' },
    { months: 3, price: 12500, label: '3 Months' },
    { months: 6, price: 22500, label: '6 Months' },
    { months: 12, price: 39000, label: '12 Months' },
];

const CATEGORIES: GoalCategory[] = ['health', 'growth', 'mindset', 'career', 'social', 'vitality'];

export default function SubscriptionManager({ onClose, initialCategory }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user } = useStore();
    const [activeTab, setActiveTab] = useState<'mission' | 'all'>('mission');
    const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeSubs, setActiveSubs] = useState<any[]>([]);

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
        return activeSubs.some(s => {
            if (new Date(s.start_date) > now || new Date(s.end_date) <= now) return false;
            if (s.type === 'all') return true;
            return s.type === 'mission' && s.target_id === selectedCategory;
        });
    })();

    const handleSubscribe = async (tier: PricingTier) => {
        if (!user) return;

        // Calculate Dates
        let startDate = new Date();
        let isExtension = false;

        if (latestRelevantSub) {
            startDate = new Date(latestRelevantSub.end_date);
            // Add a small buffer (e.g. 1 second) to avoid overlaps if needed, or just start exact same time
            // Usually start = end is fine for continuity
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
        try {
            // 1. Record Payment
            const { error: payError } = await supabase
                .from('payments')
                .insert({
                    user_id: user.id,
                    amount: tier.price,
                    plan_type: `${activeTab}_${tier.months}mo`,
                    duration_months: tier.months,
                    target_id: activeTab === 'mission' ? selectedCategory : null,
                    status: 'completed',
                    coverage_start_date: startDate.toISOString(),
                    coverage_end_date: endDate.toISOString()
                });

            if (payError) throw payError;

            // 2. Create Subscription
            const { error: subError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    type: activeTab,
                    target_id: activeTab === 'mission' ? selectedCategory : null,
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString(),
                    status: 'active'
                });

            if (subError) throw subError;

            alert(t.subscriptionSuccessful);
            await fetchData();

        } catch (error: any) {
            console.error('Subscription error:', error);
            alert(t.subscriptionFailed.replace('{error}', error.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (paymentId: string, createdAt: string) => {
        const createdDate = new Date(createdAt);
        const today = new Date();

        // Check if created today (Compare Year, Month, Day)
        const isToday = createdDate.getFullYear() === today.getFullYear() &&
            createdDate.getMonth() === today.getMonth() &&
            createdDate.getDate() === today.getDate();

        if (!isToday) {
            alert(t.onlyTodayCancel);
            return;
        }

        if (!window.confirm(t.cancelConfirm)) return;

        setLoading(true);
        try {
            // 1. Get Payment Info
            const { data: payment } = await supabase
                .from('payments')
                .select('coverage_start_date, coverage_end_date')
                .eq('id', paymentId)
                .single();

            // 2. Cancel Payment
            const { error } = await supabase
                .from('payments')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', paymentId);

            if (error) throw error;

            // 3. Cancel Subscription
            if (payment?.coverage_start_date && payment?.coverage_end_date && user?.id) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('user_id', user.id)
                    .eq('start_date', payment.coverage_start_date)
                    .eq('end_date', payment.coverage_end_date);
            }

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
                                        : t.freeRestricted}
                                    {isUnlockedNow && <Check size={16} className="text-green-500" />}
                                </h3>
                            </div>
                            {isUnlockedNow && latestRelevantSub && (
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 block">{t.expires}</span>
                                    <span className="text-xs font-mono font-bold text-white">
                                        {new Date(latestRelevantSub.end_date).toLocaleDateString()}
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
                                {(activeTab === 'mission' ? MISSION_PRICING : ALL_ACCESS_PRICING).map((tier) => (
                                    <div
                                        key={tier.months}
                                        className="p-3 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between group hover:border-primary/30 transition-all"
                                    >
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
                                ))}
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
                                                // t[item.target_id] relies on the category string matching the key exactly (health, growth...)
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
                                                                {(new Date().toDateString() === new Date(item.created_at).toDateString()) && (
                                                                    <button
                                                                        onClick={() => handleCancel(item.id, item.created_at)}
                                                                        className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                                                    >
                                                                        {t.cancelPayment}
                                                                    </button>
                                                                )}
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

                                <div className="flex justify-center gap-3 text-[10px] text-slate-500 underline">
                                    <button onClick={() => openSupportModal('terms')} className="hover:text-white transition-colors">{t.terms}</button>
                                    <button onClick={() => openSupportModal('privacy')} className="hover:text-white transition-colors">{t.privacy}</button>
                                    <button onClick={() => openSupportModal('refund')} className="hover:text-white transition-colors">{t.refundPolicy}</button>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2">
                                    My Re Design | {t.representative}: Jung Changwoo | 010-6614-4561
                                </p>
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
