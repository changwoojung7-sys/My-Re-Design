import { motion } from 'framer-motion';
import { Lock, Sparkles, Check } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import SupportModal from '../../components/layout/SupportModal';

interface PaywallProps {
    onClose?: () => void;
}

const PRO_PRICING = [
    { type: 'pro_monthly', months: 1, price: 9900, label: '1개월', subtitle: '매월 결제', save: '' },
    { type: 'pro_yearly', months: 12, price: 59000, label: '12개월', subtitle: '연 59,000원 (월 4,900원 상당)', save: '50%', best: true },
];

export default function Paywall({ onClose }: PaywallProps) {
    const { t } = useLanguage();
    const { user, setUser } = useStore();
    const [loading, setLoading] = useState(false);
    const [supportModalState, setSupportModalState] = useState<{ isOpen: boolean, view: 'main' | 'terms' | 'privacy' | 'refund' }>({
        isOpen: false,
        view: 'main'
    });

    const openSupportModal = (view: 'main' | 'terms' | 'privacy' | 'refund') => {
        setSupportModalState({ isOpen: true, view });
    };

    const handleSubscribe = async (tier: typeof PRO_PRICING[0]) => {
        if (!user) return;
        
        // Dummy Payment Logic for now (Simulate PortOne success)
        const confirmMsg = `${tier.label} Pro 플랜을 구독하시겠습니까?\n\n결제 금액: ${tier.price.toLocaleString()}원`;
        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ plan_type: tier.type })
                .eq('id', user.id);

            if (error) throw error;

            setUser({ ...user, plan_type: tier.type as any });
            alert('구독이 완료되었습니다! 이제 모든 Pro 기능을 사용할 수 있습니다.');
            if (onClose) onClose();
        } catch (e: any) {
            console.error('Subscription error:', e);
            alert('구독 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm"
        >
            {/* Close Button Area (Click to close if not strict) */}
            <div className="flex-1 w-full" onClick={onClose} />

            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-slate-900 rounded-t-3xl w-full max-h-[90vh] overflow-y-auto pb-safe"
            >
                <div className="p-6 relative">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8 pt-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-violet-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
                            <Lock size={32} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                            MyReDesign <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500">PRO</span>
                        </h2>
                        <p className="text-slate-400 text-sm mt-2">
                            잠재력을 깨우는 모든 기능을 무제한으로.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="bg-white/5 rounded-2xl p-5 mb-8 border border-white/5">
                        <ul className="space-y-4">
                            {['모든 카테고리 (Body, Mind, Growth) 미션 무제한 이용', 'AI 주간 바이브 리포트 및 심층 코칭 분석', 'Color Jam 캘린더 등 고급 통계 기능', '친구 초대 및 무제한 버디 챌린지 생성'].map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <Check size={12} className="text-primary" />
                                    </div>
                                    <span className="text-sm text-slate-200 leading-tight">{feat}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Plans Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        {PRO_PRICING.map(tier => (
                            <button
                                key={tier.type}
                                onClick={() => handleSubscribe(tier)}
                                disabled={loading}
                                className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all ${
                                    tier.best 
                                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {tier.best && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg flex items-center gap-1">
                                        <Sparkles size={10} />
                                        BEST VALUE
                                    </div>
                                )}
                                <div className="text-lg font-bold text-white mb-1 mt-1">{tier.label}</div>
                                <div className="text-xl font-black text-primary mb-1">
                                    {tier.price.toLocaleString()}원
                                </div>
                                <div className="text-[10px] text-slate-400 leading-tight">
                                    {tier.subtitle}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                        >
                            나중에 하기
                        </button>
                    </div>

                    <div className="mt-6 flex justify-center gap-4 text-[10px] text-slate-500">
                        <button onClick={() => openSupportModal('terms')} className="hover:text-white">{t.terms}</button>
                        <button onClick={() => openSupportModal('privacy')} className="hover:text-white">{t.privacy}</button>
                        <button onClick={() => openSupportModal('refund')} className="hover:text-white">{t.refundPolicy}</button>
                    </div>
                </div>
            </motion.div>

            <SupportModal
                isOpen={supportModalState.isOpen}
                onClose={() => setSupportModalState({ ...supportModalState, isOpen: false })}
                initialView={supportModalState.view}
            />
        </motion.div>
    );
}
