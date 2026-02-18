
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
        alert(`Payment Processing Error: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Check for Mobile Redirect Result
export const checkMobilePaymentResult = async () => {
    const urlParams = new URL(window.location.href).searchParams;

    // V1 Params
    const imp_success = urlParams.get('imp_success');
    const error_msg = urlParams.get('error_msg');
    const imp_uid = urlParams.get('imp_uid');
    const merchant_uid = urlParams.get('merchant_uid');

    // V2 Params (PortOne V2)
    const paymentId = urlParams.get('paymentId');
    const code = urlParams.get('code');
    const message = urlParams.get('message');

    // Case 1: V1 Failure
    if (imp_success === 'false' || error_msg) {
        return { success: false, error: error_msg || 'Mobile payment failed' };
    }

    // Case 2: V2 Failure
    if (code && code !== 'FAILURE_TYPE_PG') {
        if (!paymentId) {
            return { success: false, error: message || `Payment Failed (${code})` };
        }
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
