
import { supabase } from './supabase';

export interface PaymentTier {
    months: number;
    price: number;
    label: string;
}

export interface PaymentRequest {
    user: any;
    tier: PaymentTier;
    planType: 'mission' | 'all';
    targetCategory?: string;
    isExtension: boolean;
    currentEndDate?: Date;
}

// Payment Success Handler (Shared between PC callback and Mobile redirect)
export const processPaymentSuccess = async (
    paymentIdOrImpUid: string,
    mode: string,
    tier: PaymentTier,
    planType: 'mission' | 'all',
    targetCategory: string | null,
    startDate: Date,
    endDate: Date,
    merchantUid?: string
) => {
    try {
        // 1. Verify Payment Server-Side
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: {
                imp_uid: mode === 'real' ? undefined : paymentIdOrImpUid,
                payment_id: mode === 'real' ? paymentIdOrImpUid : undefined,
                merchant_uid: merchantUid || paymentIdOrImpUid,
                mode: mode
            }
        });

        if (verifyError) throw verifyError;
        if (verifyData?.error) throw new Error(verifyData.error);

        // 2. Record Payment
        // Check if there is a pending payment to update
        let existingId: string | null = null;

        const lookupValue = merchantUid || paymentIdOrImpUid;
        const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .or(`merchant_uid.eq.${lookupValue},imp_uid.eq.${lookupValue}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing) existingId = existing.id;

        const paymentData = {
            user_id: (await supabase.auth.getUser()).data.user?.id,
            amount: tier.price,
            plan_type: `${planType}_${tier.months}mo`,
            duration_months: tier.months,
            target_id: targetCategory,
            status: 'paid',
            merchant_uid: merchantUid || paymentIdOrImpUid,
            imp_uid: paymentIdOrImpUid,
            coverage_start_date: startDate.toISOString(),
            coverage_end_date: endDate.toISOString()
        };

        let payError;
        if (existingId) {
            const { error } = await supabase
                .from('payments')
                .update(paymentData)
                .eq('id', existingId);
            payError = error;
        } else {
            const { error } = await supabase
                .from('payments')
                .insert(paymentData);
            payError = error;
        }

        if (payError) throw payError;

        // 3. Create Subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: (await supabase.auth.getUser()).data.user?.id,
                type: planType,
                target_id: targetCategory,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                status: 'active'
            });

        if (subError) throw subError;

        // 4. Update Profile (Best effort)
        try {
            await supabase.from('profiles').update({
                subscription_tier: 'premium'
            }).eq('id', (await supabase.auth.getUser()).data.user?.id);
        } catch (e) {
            console.warn('Profile update failed', e);
        }

        return {
            success: true,
            data: {
                planName: `${planType === 'all' ? 'All Access' : targetCategory} (${tier.label})`,
                amount: tier.price,
                startDate: startDate,
                endDate: endDate
            }
        };
    } catch (error: any) {
        console.error('Payment processing error:', error);
        // Alert is handled by the caller (App.tsx or component)
        return { success: false, error: error.message };
    }
};

export const processPaymentFailure = async (paymentIdOrImpUid: string) => {
    try {
        const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .or(`merchant_uid.eq.${paymentIdOrImpUid},imp_uid.eq.${paymentIdOrImpUid}`)
            .eq('status', 'pending')
            .maybeSingle();

        if (existing) {
            await supabase
                .from('payments')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', existing.id);
        }
    } catch (error) {
        console.error('Error processing payment failure:', error);
    }
};

// Check for Mobile Redirect Result
export const checkMobilePaymentResult = async (customUrl?: string) => {
    const urlString = customUrl || window.location.href;
    const urlParams = new URL(urlString).searchParams;

    // V1 Params
    const imp_success = urlParams.get('imp_success');
    const error_msg = urlParams.get('error_msg');
    const imp_uid = urlParams.get('imp_uid');
    const merchant_uid = urlParams.get('merchant_uid');

    // V2 Params (PortOne V2)
    const paymentId = urlParams.get('paymentId');
    const code = urlParams.get('code');
    const message = urlParams.get('message');

    // Case 1: V1 Failure Check (Strict)
    // If imp_success is explicitly 'false', OR if it's MISSING (and we are in a redirect flow with imp_uid), treat as fail.
    // We should only proceed if imp_success === 'true'.
    // Note: Some flows might use 'success' instead of 'imp_success'.
    const successFlag = imp_success || urlParams.get('success');

    if (successFlag !== 'true') {
        // If we have an error message, use it. If not, generic cancellation/fail.
        // But only if we actually HAVE some ID (meaning it's a payment redirect, not just a random page load)
        if (imp_uid || merchant_uid) {
            return { success: false, error: error_msg || 'Payment Cancelled or Failed' };
        }
    }

    // Case 2: V2 Failure (PortOne V2)
    if (code) {
        // PortOne V2에서 code 파라미터가 넘어오면 결제 과정에 문제가 있거나 취소된 경우입니다.
        return { success: false, error: message || `Payment Failed (${code})` };
    }

    // Case 3: Success (V1 or V2)
    const targetId = paymentId || imp_uid || merchant_uid;

    if (targetId) {
        // Attempt to recover state from LocalStorage first
        let paymentData: any = null;
        const pendingPayment = localStorage.getItem('pending_payment');

        if (pendingPayment) {
            paymentData = JSON.parse(pendingPayment);
            localStorage.removeItem('pending_payment');
        } else {
            // Fallback: Recover from DB (Session persistence)
            console.log('Attempting to recover session from DB for:', targetId);
            const { data: pendingRecord } = await supabase
                .from('payments')
                .select('*')
                .or(`merchant_uid.eq.${targetId},imp_uid.eq.${targetId}`)
                .eq('status', 'pending')
                .maybeSingle();

            if (pendingRecord) {
                // Reconstruct data
                const [typeStr, durationStr] = pendingRecord.plan_type.split('_');
                // typeStr: 'mission' or 'all'
                // durationStr: '1mo', '3mo' -> parse int
                const duration = parseInt(durationStr);

                paymentData = {
                    mode: targetId.startsWith('pay_') ? 'real' : 'test', // Auto-detect mode
                    tier: {
                        months: duration,
                        price: pendingRecord.amount,
                        label: `${duration} Months` // Approx label
                    },
                    planType: typeStr as 'mission' | 'all',
                    targetCategory: pendingRecord.target_id,
                    startDate: pendingRecord.coverage_start_date,
                    endDate: pendingRecord.coverage_end_date
                };
            }
        }

        if (paymentData) {
            return await processPaymentSuccess(
                targetId,
                paymentData.mode,
                paymentData.tier,
                paymentData.planType,
                paymentData.targetCategory,
                new Date(paymentData.startDate),
                new Date(paymentData.endDate),
                merchant_uid || undefined
            );
        }

        return { success: false, error: 'Session lost during redirect. Please check your page.' };
    }

    return null;
};

// 앱이 Background에서 Foreground로 돌아올 때 (resume) 딥링크 없이 돌아온 경우 대비 서버 검증
export const checkPendingPaymentAndRecover = async () => {
    try {
        const pendingPaymentStr = localStorage.getItem('pending_payment');
        if (!pendingPaymentStr) return null;

        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
            localStorage.removeItem('pending_payment');
            return null;
        }

        // DB에서 최신 pending 결제내역 조회
        const { data: pendingRecord } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', userData.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (pendingRecord) {
            const mode = pendingRecord.merchant_uid.startsWith('pay_') ? 'real' : 'test';
            
            try {
                // 포트원 검증(verify-payment) 호출로 실제 결제 여부 파악
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
                    body: {
                        imp_uid: mode === 'real' ? undefined : pendingRecord.imp_uid,
                        payment_id: mode === 'real' ? pendingRecord.imp_uid : undefined,
                        merchant_uid: pendingRecord.merchant_uid,
                        mode: mode
                    }
                });

                if (verifyError || verifyData?.error) {
                    // 미완료 또는 검증 실패 -> 취소된 것으로 간주
                    await processPaymentFailure(pendingRecord.merchant_uid);
                    localStorage.removeItem('pending_payment');
                    return { success: false, error: '결제가 취소되었거나 정상적으로 완료되지 않았습니다.' };
                }

                // 검증 성공 -> JS 레이어에서 못 잡은 딥링크 대신 성공 처리 진행
                const paymentData = JSON.parse(pendingPaymentStr);
                localStorage.removeItem('pending_payment');

                return await processPaymentSuccess(
                    pendingRecord.imp_uid || pendingRecord.merchant_uid,
                    paymentData.mode,
                    paymentData.tier,
                    paymentData.planType,
                    paymentData.targetCategory,
                    new Date(paymentData.startDate),
                    new Date(paymentData.endDate),
                    pendingRecord.merchant_uid
                );
            } catch (e) {
                console.warn('Could not verify pending payment on resume:', e);
                return { success: false, error: '서버 상태를 확인하는 중 오류가 발생했습니다.' };
            }
        } else {
            // DB에도 pending 상태가 없으면 지워버림 (이미 콜백 등에서 처리됨)
            localStorage.removeItem('pending_payment');
        }
    } catch (e) {
        console.error('Error in checkPendingPaymentAndRecover:', e);
    }
    return null;
};

