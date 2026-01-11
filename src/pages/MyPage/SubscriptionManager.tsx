import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Clock, Check, X } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { GoalCategory } from './MyPage';

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

export default function SubscriptionManager({ onClose, initialCategory }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user } = useStore(); // Need setUser to update local state if we were syncing deeply
    const [activeTab, setActiveTab] = useState<PlanType>('mission');
    const [history, setHistory] = useState<any[]>([]);
    const [activeSubs, setActiveSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

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

        // Fetch Subscriptions
        const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('end_date', new Date().toISOString());
        if (subData) setActiveSubs(subData);
    };

    if (!user) return null;

    const getActiveSub = (type: PlanType, target: string | null) => {
        return activeSubs.find(s =>
            s.type === type && (type === 'all' || s.target_id === target)
        );
    };

    const hasAllAccess = !!getActiveSub('all', null);
    const hasMissionAccess = !!getActiveSub('mission', initialCategory);

    // Logic: If user has 'all' access, they have everything. 
    // If not, checked generic 'mission' access for specific category.
    const isCurrentCategoryUnlocked = hasAllAccess || hasMissionAccess;

    const handleSubscribe = async (tier: PricingTier) => {
        if (!user) return;

        // Mock Payment Processing
        const confirmMsg = t.subscribeConfirm
            .replace('{target}', activeTab === 'all' ? 'All Access' : initialCategory)
            .replace('{months}', String(tier.months))
            .replace('{price}', tier.price.toLocaleString());

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
                    target_id: activeTab === 'mission' ? initialCategory : null,
                    status: 'completed'
                });

            if (payError) throw payError;

            // 2. Create/Update Subscription
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + tier.months);

            const { error: subError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    type: activeTab,
                    target_id: activeTab === 'mission' ? initialCategory : null,
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CreditCard className="text-primary" size={24} />
                        {t.manageSubscription}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Compact Current Plan Status */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-4 mb-6 border border-white/5">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t.currentStatusFor} <span className="text-primary">{initialCategory.toUpperCase()}</span></p>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {hasAllAccess
                                    ? t.unlockedPremium
                                    : isCurrentCategoryUnlocked
                                        ? t.missionSubscribed
                                        : t.freeRestricted}
                                {isCurrentCategoryUnlocked && <Check size={16} className="text-green-500" />}
                            </h3>
                        </div>
                        {isCurrentCategoryUnlocked && (
                            <div className="text-right">
                                <span className="text-xs text-slate-400 block">{t.expires}</span>
                                <span className="text-xs font-mono font-bold text-white">
                                    {new Date(
                                        (hasAllAccess ? getActiveSub('all', null) : getActiveSub('mission', initialCategory))?.end_date
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

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

                {/* Pricing Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {(activeTab === 'mission' ? MISSION_PRICING : ALL_ACCESS_PRICING).map((tier) => (
                        <button
                            key={tier.months}
                            onClick={() => handleSubscribe(tier)}
                            disabled={loading}
                            className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden group ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'
                                } ${
                                // Highlight if active (naive check)
                                false ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/5'
                                }`}
                        >
                            <p className="text-xs text-slate-400 font-bold mb-1">{tier.label}</p>
                            <p className="text-lg font-bold text-white">₩{tier.price.toLocaleString()}</p>
                            {/* Hover Effect */}
                            <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button>
                    ))}
                </div>

                <p className="text-[10px] text-slate-500 text-center mb-6">
                    {activeTab === 'mission'
                        ? t.unlocksMissionOnly.replace('{category}', initialCategory.toUpperCase())
                        : t.unlocksAllAccess}
                </p>

                {/* Payment History Section */}
                <div className="border-t border-white/10 pt-4">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        {t.history}
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {history.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">{t.noPaymentHistory}</p>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="bg-white/5 p-3 rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-white capitalise">
                                            {item.plan_type.replace('_', ' ').toUpperCase()}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-primary">₩{Number(item.amount).toLocaleString()}</p>
                                        {item.target_id && (
                                            <p className="text-[10px] text-slate-500 capitalize">{item.target_id}</p>
                                        )}
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
