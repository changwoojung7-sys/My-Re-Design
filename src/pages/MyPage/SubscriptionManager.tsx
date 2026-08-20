import { useState } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { GoalCategory } from './MyPage';
import SupportModal from '../../components/layout/SupportModal';

interface SubscriptionManagerProps {
    onClose: () => void;
    initialCategory?: GoalCategory;
}

const PRO_PRICING = [
    { type: 'pro_monthly', months: 1, price: 9900, label: '1개월', subtitle: '매월 결제' },
    { type: 'pro_yearly', months: 12, price: 59000, label: '12개월', subtitle: '연 59,000원 (월 4,900원 상당)' },
];

export default function SubscriptionManager({ onClose }: SubscriptionManagerProps) {
    const { t } = useLanguage();
    const { user, setUser } = useStore();
    const [loading, setLoading] = useState(false);

    // Support Modal State
    const [supportModalState, setSupportModalState] = useState<{
        isOpen: boolean;
        view: 'main' | 'terms' | 'privacy' | 'refund';
    }>({ isOpen: false, view: 'main' });

    const openSupportModal = (view: 'main' | 'terms' | 'privacy' | 'refund' = 'main') => {
        setSupportModalState({ isOpen: true, view });
    };

    const handleSubscribe = async (tier: typeof PRO_PRICING[0]) => {
        if (!user) return;
        
        // Dummy Payment Logic for now (Simulate PortOne success)
        const confirmMsg = `${tier.label} Pro 플랜을 구독하시겠습니까?\n\n결제 금액: ${tier.price.toLocaleString()}원`;
        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        try {
            // Update profile
            const { error } = await supabase
                .from('profiles')
                .update({ plan_type: tier.type })
                .eq('id', user.id);

            if (error) throw error;

            setUser({ ...user, plan_type: tier.type as any });
            alert('구독이 완료되었습니다! 이제 모든 Pro 기능을 사용할 수 있습니다.');
            onClose();
        } catch (e: any) {
            console.error('Subscription error:', e);
            alert('구독 처리 중 오류가 발생했습니다.');
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
                    {PRO_PRICING.map(tier => (
                        <div 
                            key={tier.type}
                            className="bg-slate-800/50 rounded-3xl p-1 border border-white/10 hover:border-primary/50 transition-colors overflow-hidden"
                        >
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-lg font-bold text-white">{tier.label}</span>
                                    <span className="text-xl font-black text-primary">{tier.price.toLocaleString()}원</span>
                                </div>
                                <p className="text-xs text-slate-400">{tier.subtitle}</p>
                            </div>
                            <button
                                onClick={() => handleSubscribe(tier)}
                                disabled={loading || user?.plan_type === tier.type}
                                className={`w-full py-4 text-sm font-bold transition-colors ${
                                    user?.plan_type === tier.type 
                                        ? 'bg-white/10 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary text-black hover:bg-primary/90'
                                }`}
                            >
                                {user?.plan_type === tier.type ? '현재 이용 중인 플랜' : '구독하기'}
                            </button>
                        </div>
                    ))}
                </div>

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
