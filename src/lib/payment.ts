
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
        const { error: payError } = await supabase
            .from('payments')
            .insert({
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
            });

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

        return { success: true };
    } catch (error: any) {
        console.error('Payment processing error:', error);
        return { success: false, error: error.message };
    }
};

// Check for Mobile Redirect Result
export const checkMobilePaymentResult = async () => {
    const urlParams = new URL(window.location.href).searchParams;
    const imp_success = urlParams.get('imp_success');
    const error_msg = urlParams.get('error_msg');
    const imp_uid = urlParams.get('imp_uid');
    const merchant_uid = urlParams.get('merchant_uid');

    // Only process if parameters exist
    if (imp_success === null && !error_msg && !imp_uid) return null;

    if (imp_success === 'false' || error_msg) {
        return { success: false, error: error_msg || 'Mobile payment failed' };
    }

    if (imp_uid && merchant_uid) {
        // IMPORTANT: We need to reconstruct the plan details from localStorage or merchant_uid
        // Since mobile redirect loses state, we should have saved the pending payment intent
        const pendingPayment = localStorage.getItem('pending_payment');
        if (pendingPayment) {
            const paymentData = JSON.parse(pendingPayment);
            localStorage.removeItem('pending_payment'); // Clear immediately

            // Now call process
            return await processPaymentSuccess(
                imp_uid,
                paymentData.mode,
                paymentData.tier,
                paymentData.planType,
                paymentData.targetCategory,
                new Date(paymentData.startDate), // Restore Date objects
                new Date(paymentData.endDate),
                merchant_uid
            );
        }
        return { success: false, error: 'Session lost during redirect' };
    }

    return null;
};
