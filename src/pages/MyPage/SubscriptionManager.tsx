import { useState, useEffect } from 'react';
import { Check, X, Sparkles, Receipt, Loader2 } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { GoalCategory } from './MyPage';
import SupportModal from '../../components/layout/SupportModal';
import { requestSubscriptionPayment } from '../../lib/payment';

interface SubscriptionManagerProps {
    onClose: () => void;
    initialCategory?: GoalCategory;
}

const PRO_PRICING = [
    { type: 'pro_monthly', months: 1, price: 2900, label: '1개월 패스', subtitle: '기본형', save: '', badge: '기본형' },
    { type: 'pro_quarterly', months: 3, price: 7900, label: '3개월 패스', subtitle: '10% 할인 (정상가 8,700원)', save: '10%', badge: '인기', best: true },
    { type: 'pro_yearly', months: 12, price: 29900, label: '1년 패스', subtitle: '15% 할인 (정상가 34,800원)', save: '15%', badge: '최고 가치' },
];

export default function SubscriptionManager({ onClose }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user } = useStore();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);

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
            fetchHistoryAndSync();
        }
    }, [user?.id]);

    const fetchHistoryAndSync = async () => {
        if (!user) return;
        try {
            // 1. Fetch Payments History
            const { data: payData } = await supabase
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (payData) setHistory(payData.filter((p: any) => p.status === 'paid'));

            // 2. Fetch Active Subscriptions
            const now = new Date().toISOString();
            const { data: activeSubs } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .gt('end_date', now);

            if (activeSubs) setActiveSubscriptions(activeSubs);
            const hasActiveSub = activeSubs && activeSubs.length > 0;

            // 3. If user has pro plan_type but NO active subscription, reset to 'free'
            if (!hasActiveSub && (user.plan_type === 'pro_monthly' || user.plan_type === 'pro_yearly')) {
                await supabase
                    .from('profiles')
                    .update({ plan_type: 'free', subscription_tier: 'free' })
                    .eq('id', user.id);

                useStore.getState().setUser({
                    ...user,
                    plan_type: 'free',
                    subscription_tier: 'free' as any
                });
            } else if (hasActiveSub && user.plan_type === 'free') {
                // If user has active sub but plan_type is free, sync to active sub
                const latestSub = activeSubs[0];
                const newPlan = latestSub.type === 'pro_yearly' ? 'pro_yearly' : 'pro_monthly';
                await supabase
                    .from('profiles')
                    .update({ plan_type: newPlan, subscription_tier: 'premium' })
                    .eq('id', user.id);

                useStore.getState().setUser({
                    ...user,
                    plan_type: newPlan as any,
                    subscription_tier: 'premium' as any
                });
            }
        } catch (e) {
            console.error('Error syncing subscription/payment data:', e);
        }
    };

    const handleSubscribe = async (tier: typeof PRO_PRICING[0]) => {
        if (!user) {
            alert('로그인이 필요한 서비스입니다.');
            return;
        }

        setLoading(true);
        try {
            const result = await requestSubscriptionPayment(user, tier, window.location.pathname);
            if (result.success) {
                alert('구독이 완료되었습니다! 이제 모든 Pro 기능을 사용할 수 있습니다.');
                await fetchHistoryAndSync();
                onClose();
            } else if (result.error) {
                alert(result.error);
            }
        } catch (e: any) {
            console.error('Subscription error:', e);
            alert('결제 처리 중 오류가 발생했습니다: ' + (e.message || '다시 시도해주세요.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/95 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pt-2 px-2">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-primary" size={24} />
                        MyReDesign Pro
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        성장을 가속화하는 모든 프리미엄 기능 무제한 이용
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-2 pb-24">
                
                {/* Benefits */}
                <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
                    <h3 className="text-sm font-bold text-white mb-4">Pro 혜택 안내</h3>
                    <ul className="space-y-3">
                        {['모든 카테고리 (Body, Mind, Growth) 미션 무제한 이용', 'AI 주간 바이브 리포트 및 심층 코칭 분석', 'Color Jam 캘린더 등 고급 통계 기능', '친구 초대 및 무제한 버디 챌린지 생성'].map((benefit, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <div className="mt-0.5 text-primary shrink-0">
                                    <Check size={16} />
                                </div>
                                <span className="text-sm text-slate-300">{benefit}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Plans */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white px-1">플랜 선택</h3>
                    {PRO_PRICING.map(tier => {
                        const isCurrentPlan = user?.plan_type === tier.type;
                        const currentSub = isCurrentPlan && activeSubscriptions.length > 0 ? activeSubscriptions[0] : null;
                        let isExpiringSoon = false;
                        let endDateStr = '';
                        if (currentSub) {
                            const endDate = new Date(currentSub.end_date);
                            endDateStr = endDate.toLocaleDateString('ko-KR');
                            isExpiringSoon = endDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
                        }

                        const disableButton = loading || (isCurrentPlan && !isExpiringSoon);

                        return (
                            <div 
                                key={tier.type}
                                className={`rounded-3xl p-1 border transition-all overflow-hidden relative ${
                                    tier.best 
                                        ? 'bg-slate-800/80 border-primary/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
                                        : 'bg-slate-800/50 border-white/10 hover:border-primary/30'
                                }`}
                            >
                                {tier.badge && (
                                    <div className={`absolute top-3 right-4 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md ${tier.best ? 'bg-gradient-to-r from-primary to-pink-500' : 'bg-slate-700'}`}>
                                        {tier.badge}
                                    </div>
                                )}
                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-lg font-bold text-white">{tier.label}</span>
                                        <span className="text-xl font-black text-primary">{tier.price.toLocaleString()}원</span>
                                    </div>
                                    <p className="text-xs text-slate-400">{tier.subtitle}</p>
                                </div>
                                <button
                                    onClick={() => handleSubscribe(tier)}
                                    disabled={disableButton}
                                    className={`w-full py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                        disableButton 
                                            ? 'bg-white/10 text-slate-400 cursor-not-allowed'
                                            : 'bg-primary text-black hover:bg-primary/90 active:scale-[0.99]'
                                    }`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>결제창 준비 중...</span>
                                        </>
                                    ) : isCurrentPlan ? (
                                        isExpiringSoon ? '만료 예정 (재구독 가능)' : `구독중 (~${endDateStr})`
                                    ) : (
                                        '구독하기'
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Payment History Section */}
                {history.length > 0 && (
                    <div className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                            <Receipt size={16} className="text-primary" />
                            <span>결제 내역</span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {history.slice(0, 5).map((item) => (
                                <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                                    <div>
                                        <p className="text-slate-200 font-medium">
                                            {item.plan_type === 'pro_yearly' ? 'Pro 12개월' : item.plan_type === 'pro_monthly' ? 'Pro 1개월' : item.plan_type}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                            {item.coverage_end_date && ` ~ ${new Date(item.coverage_end_date).toLocaleDateString('ko-KR')}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-primary">₩{Number(item.amount).toLocaleString()}</p>
                                        <p className={`text-[10px] ${item.status === 'paid' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                            {item.status === 'paid' ? '결제완료' : item.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Links */}
                <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-x-6 gap-y-3 px-4">
                    <button onClick={() => openSupportModal('terms')} className="text-xs text-slate-500 hover:text-white transition-colors">{t.terms}</button>
                    <button onClick={() => openSupportModal('privacy')} className="text-xs text-slate-500 hover:text-white transition-colors">{t.privacy}</button>
                    <button onClick={() => openSupportModal('refund')} className="text-xs text-slate-500 hover:text-white transition-colors">{t.refundPolicy}</button>
                </div>
            </div>

            {/* Support Modal */}
            <SupportModal
                isOpen={supportModalState.isOpen}
                onClose={() => setSupportModalState({ ...supportModalState, isOpen: false })}
                initialView={supportModalState.view}
            />
        </div>
    );
}
