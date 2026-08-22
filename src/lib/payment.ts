import { supabase } from './supabase';
import { useStore } from './store';

declare global {
    interface Window {
        IMP?: any;
        PortOne?: any;
    }
}

export interface PaymentTier {
    type: string;
    months: number;
    price: number;
    label: string;
    subtitle?: string;
    save?: string;
    best?: boolean;
}

export interface PaymentRequest {
    user: any;
    tier: PaymentTier;
    planType: string;
    targetCategory?: string;
    isExtension?: boolean;
    currentEndDate?: Date;
}

// Payment Success Handler (Shared between PC callback and Mobile redirect)
export const processPaymentSuccess = async (
    paymentIdOrImpUid: string,
    mode: string,
    tier: PaymentTier,
    planType: string,
    targetCategory: string | null,
    startDate: Date,
    endDate: Date,
    merchantUid?: string
) => {
    try {
        // 1. Verify Payment Server-Side via Supabase Edge Function
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

        const currentUser = (await supabase.auth.getUser()).data.user;
        if (!currentUser) throw new Error('User not authenticated');

        // 2. Record / Update Payment in DB
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
            user_id: currentUser.id,
            amount: tier.price,
            plan_type: tier.type || `${planType}_${tier.months}mo`,
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

        if (payError) {
            console.error('Error saving payment record:', payError);
        }

        // 3. Create Subscription Record
        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: currentUser.id,
                type: planType === 'pro_yearly' || planType === 'pro_monthly' ? 'pro' : planType,
                target_id: targetCategory,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                status: 'active'
            });

        if (subError) {
            console.error('Error creating subscription record:', subError);
        }

        // 4. Update Profile
        const newPlanType = tier.type || (tier.months === 12 ? 'pro_yearly' : 'pro_monthly');
        try {
            await supabase.from('profiles').update({
                subscription_tier: 'premium',
                plan_type: newPlanType
            }).eq('id', currentUser.id);

            // Update Zustand Store
            const storeUser = useStore.getState().user;
            if (storeUser) {
                useStore.getState().setUser({
                    ...storeUser,
                    plan_type: newPlanType as any,
                    subscription_tier: 'premium' as any
                });
            }
        } catch (e) {
            console.warn('Profile update failed', e);
        }

        localStorage.removeItem('pending_payment');

        return {
            success: true,
            data: {
                planName: `MyReDesign Pro (${tier.label})`,
                amount: tier.price,
                startDate: startDate,
                endDate: endDate
            }
        };
    } catch (error: any) {
        console.error('Payment processing error:', error);
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

// Main Entry Point for Requesting Subscription Payment
export const requestSubscriptionPayment = async (
    user: any,
    tier: PaymentTier,
    redirectPath: string = '/mypage'
): Promise<{ success: boolean; error?: string; data?: any }> => {
    if (!user) {
        return { success: false, error: '로그인이 필요합니다.' };
    }

    try {
        // 1. Check Global Payment Mode from admin_settings (default: 'real')
        let mode = 'real';
        try {
            const { data: modeSetting } = await supabase
                .from('admin_settings')
                .select('value')
                .eq('key', 'payment_mode')
                .maybeSingle();
            if (modeSetting?.value) {
                mode = modeSetting.value;
            }
        } catch (e) {
            console.warn('Failed to fetch payment mode setting, defaulting to real:', e);
        }

        // 2. Prepare Dates
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + tier.months);

        // 3. Prepare IDs
        const merchantUid = `mid_${Date.now()}`;
        const paymentId = mode === 'real' ? `pay_${Date.now()}` : merchantUid;

        // 4. Save Pending Payment in DB
        try {
            await supabase.from('payments').insert({
                user_id: user.id,
                amount: tier.price,
                plan_type: tier.type,
                duration_months: tier.months,
                target_id: null,
                status: 'pending',
                merchant_uid: merchantUid,
                imp_uid: paymentId,
                coverage_start_date: startDate.toISOString(),
                coverage_end_date: endDate.toISOString()
            });
        } catch (e) {
            console.warn('Failed to insert pending payment record:', e);
        }

        // 5. Save state for mobile redirect recovery
        const saveState = {
            mode,
            tier,
            planType: tier.type,
            targetCategory: null,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
        localStorage.setItem('pending_payment', JSON.stringify(saveState));

        // 6. Execute Payment
        if (mode === 'real') {
            // --- PortOne V2 (Real KG Inicis) ---
            const PORTONE_V2_STORE_ID = 'store-25bcb4a5-4d9e-440e-9aea-b20559181588';
            const PORTONE_V2_CHANNEL_KEY = 'channel-key-eeaefe66-b5b0-4d67-a320-bb6a8e6ad7dd';

            if (!window.PortOne) {
                throw new Error('결제 모듈(PortOne V2)이 로드되지 않았습니다.');
            }

            const response = await window.PortOne.requestPayment({
                storeId: PORTONE_V2_STORE_ID,
                channelKey: PORTONE_V2_CHANNEL_KEY,
                paymentId: paymentId,
                orderName: `MyReDesign Pro - ${tier.label}`,
                totalAmount: tier.price,
                currency: "CURRENCY_KRW",
                payMethod: "CARD",
                customer: {
                    email: user.email || undefined,
                    phoneNumber: user.phone || "01000000000",
                    fullName: user.nickname || "고객"
                },
                redirectUrl: `${window.location.origin}${redirectPath}`
            });

            if (response && response.code != null) {
                await processPaymentFailure(paymentId);
                localStorage.removeItem('pending_payment');
                return { success: false, error: response.message || '결제가 취소되었거나 실패했습니다.' };
            }

            // PC Success Flow
            return await processPaymentSuccess(
                paymentId,
                mode,
                tier,
                tier.type,
                null,
                startDate,
                endDate,
                merchantUid
            );
        } else {
            // --- PortOne V1 (Test Mode) ---
            return new Promise((resolve) => {
                const { IMP } = window;
                if (!IMP) {
                    resolve({ success: false, error: '결제 모듈(PortOne V1)이 로드되지 않았습니다.' });
                    return;
                }

                IMP.init('imp77227041');
                IMP.request_pay({
                    pg: 'html5_inicis',
                    pay_method: 'card',
                    merchant_uid: merchantUid,
                    name: `MyReDesign Pro - ${tier.label}`,
                    amount: tier.price,
                    buyer_email: user.email,
                    buyer_name: user.nickname || 'User',
                    m_redirect_url: `${window.location.origin}${redirectPath}`
                }, async (rsp: any) => {
                    if (rsp.success) {
                        const result = await processPaymentSuccess(
                            rsp.imp_uid,
                            'test',
                            tier,
                            tier.type,
                            null,
                            startDate,
                            endDate,
                            merchantUid
                        );
                        resolve(result);
                    } else {
                        localStorage.removeItem('pending_payment');
                        await processPaymentFailure(merchantUid);
                        resolve({ success: false, error: rsp.error_msg || '결제가 취소되었습니다.' });
                    }
                });
            });
        }
    } catch (error: any) {
        console.error('requestSubscriptionPayment error:', error);
        localStorage.removeItem('pending_payment');
        return { success: false, error: error.message || '결제 요청 중 오류가 발생했습니다.' };
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
    const successFlag = imp_success || urlParams.get('success');

    if (successFlag !== 'true') {
        if (imp_uid || merchant_uid) {
            return { success: false, error: error_msg || 'Payment Cancelled or Failed' };
        }
    }

    // Case 2: V2 Failure (PortOne V2)
    if (code) {
        return { success: false, error: message || `Payment Failed (${code})` };
    }

    // Case 3: Success (V1 or V2)
    const targetId = paymentId || imp_uid || merchant_uid;

    if (targetId) {
        let paymentData: any = null;
        const pendingPayment = localStorage.getItem('pending_payment');

        if (pendingPayment) {
            paymentData = JSON.parse(pendingPayment);
            localStorage.removeItem('pending_payment');
        } else {
            console.log('Attempting to recover session from DB for:', targetId);
            const { data: pendingRecord } = await supabase
                .from('payments')
                .select('*')
                .or(`merchant_uid.eq.${targetId},imp_uid.eq.${targetId}`)
                .eq('status', 'pending')
                .maybeSingle();

            if (pendingRecord) {
                const duration = pendingRecord.duration_months || 1;
                paymentData = {
                    mode: targetId.startsWith('pay_') ? 'real' : 'test',
                    tier: {
                        type: pendingRecord.plan_type || 'pro_monthly',
                        months: duration,
                        price: pendingRecord.amount,
                        label: `${duration} Months`
                    },
                    planType: pendingRecord.plan_type || 'pro_monthly',
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

// Recover Pending Payment when App Resumes from Background
export const checkPendingPaymentAndRecover = async () => {
    try {
        const pendingPaymentStr = localStorage.getItem('pending_payment');
        if (!pendingPaymentStr) return null;

        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
            localStorage.removeItem('pending_payment');
            return null;
        }

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
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
                    body: {
                        imp_uid: mode === 'real' ? undefined : pendingRecord.imp_uid,
                        payment_id: mode === 'real' ? pendingRecord.imp_uid : undefined,
                        merchant_uid: pendingRecord.merchant_uid,
                        mode: mode
                    }
                });

                if (verifyError || verifyData?.error) {
                    await processPaymentFailure(pendingRecord.merchant_uid);
                    localStorage.removeItem('pending_payment');
                    return { success: false, error: '결제가 취소되었거나 정상적으로 완료되지 않았습니다.' };
                }

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
            localStorage.removeItem('pending_payment');
        }
    } catch (e) {
        console.error('Error in checkPendingPaymentAndRecover:', e);
    }
    return null;
};
