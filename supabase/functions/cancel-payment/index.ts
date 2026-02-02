import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Check if the user is authenticated
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        const { imp_uid, merchant_uid, reason, cancel_amount, action, subscription_id } = await req.json()

        // Handle Admin Force Delete Subscription
        if (action === 'delete_subscription') {
            if (!subscription_id) throw new Error('Missing subscription_id');
            const { error: delError } = await supabaseClient
                .from('subscriptions')
                .delete()
                .eq('id', subscription_id);

            if (delError) throw delError;

            return new Response(
                JSON.stringify({ success: true, message: 'Subscription deleted' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!imp_uid && !merchant_uid) {
            throw new Error('Missing imp_uid or merchant_uid')
        }

        // Check if it's a V2 Payment (starts with 'pay_')
        const isV2 = imp_uid && imp_uid.startsWith('pay_');

        let resultData;

        if (isV2) {
            // 2a. V2 Cancellation
            const PORTONE_API_SECRET = Deno.env.get('PORTONE_API_SECRET');
            if (!PORTONE_API_SECRET) {
                throw new Error("Server Configuration Error: PortOne API Secret is missing.");
            }

            const v2CancelResponse = await fetch(`https://api.portone.io/payments/${imp_uid}/cancel`, {
                method: "POST",
                headers: {
                    "Authorization": `PortOne ${PORTONE_API_SECRET}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    reason: reason || 'User requested cancellation'
                })
            });

            if (!v2CancelResponse.ok) {
                const errorText = await v2CancelResponse.text();
                // If it's "PAYMENT_ALREADY_CANCELLED", treat as success
                if (errorText.includes('PAYMENT_ALREADY_CANCELLED')) {
                    console.log('Payment already cancelled, proceeding to DB');
                } else {
                    throw new Error(`PortOne V2 Cancellation Failed: ${errorText}`);
                }
            }

            // V2 doesn't return the same structure, but if OK, it's done.
            // We can fetch the cancelled payment details if needed, but for now assume success.
            resultData = { status: 'cancelled', message: 'V2 Cancellation Successful' };

        } else {
            // 2b. V1 Cancellation (Existing Logic)
            // 1. Get PortOne Access Token
            // IMP_KEY: 8817338050146283
            // IMP_SECRET: ...
            const IMP_KEY = Deno.env.get('IMP_KEY') || '8817338050146283';
            const IMP_SECRET = Deno.env.get('IMP_SECRET') || '81ftGc90jXZfuAARMfF2etd6pD0YRri1Un4TFqZN64qYnalg38dxud3P3fqBc6D5LO80A9FYJySE31KX';

            const tokenResponse = await fetch("https://api.iamport.kr/users/getToken", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imp_key: IMP_KEY,
                    imp_secret: IMP_SECRET
                }),
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.code !== 0) {
                throw new Error(`Failed to get access token: ${tokenData.message}`);
            }

            const { access_token } = tokenData.response;

            // 2. Request Cancellation
            const cancelBody: any = {
                reason: reason || 'User requested cancellation',
            };
            if (imp_uid) cancelBody.imp_uid = imp_uid;
            if (merchant_uid) cancelBody.merchant_uid = merchant_uid;
            if (cancel_amount) cancelBody.amount = cancel_amount;

            const cancelResponse = await fetch("https://api.iamport.kr/payments/cancel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": access_token
                },
                body: JSON.stringify(cancelBody),
            });

            const cancelData = await cancelResponse.json();

            if (cancelData.code !== 0) {
                throw new Error(`Cancellation failed: ${cancelData.message}`);
            }
            resultData = cancelData.response;
        }

        // 3. Update Supabase Database
        // Cancel Payment Record
        const { error: payError } = await supabaseClient
            .from('payments')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
            })
            .match(imp_uid ? { imp_uid } : { merchant_uid });

        if (payError) throw payError;

        // Find and Cancel Subscription
        // Logic: Find active subscription that matches the payment's timeframe/user
        // For simplicity, we can try to trust the client to pass the sub_id or find it here.
        // But since we already have logic on client that might be flawed, let's try to do it robustly here if possible.
        // However, finding the EXACT subscription from just payment ID can be tricky without a direct FK.
        // For MVP, we will rely on client updating the UI or calling another endpoint, BUT 
        // strictly speaking, the backend should handle this state consistency.

        // Let's try to find the payment first to get details (if we didn't just update it blindly)
        const { data: payment } = await supabaseClient
            .from('payments')
            .select('*')
            .match(imp_uid ? { imp_uid } : { merchant_uid })
            .single();

        if (payment) {
            const typeStr = payment.plan_type || '';
            const [type] = typeStr.split('_'); // 'mission' or 'all'

            // Build query
            let subQuery = supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('user_id', payment.user_id)
                .eq('type', type || 'all')
                .eq('status', 'active');

            // Refine by target_id if applicable (for mission plans)
            if (payment.target_id) {
                subQuery = subQuery.eq('target_id', payment.target_id);
            }

            const { data: subs } = await subQuery;

            if (subs && subs.length > 0) {
                const expectedStart = new Date(payment.coverage_start_date).getTime();

                // Find best match with wider tolerance (60s)
                // Sometimes DB writes for payment and sub happen with small delay depending on client latency
                const match = subs.find((s: any) => {
                    const sStart = new Date(s.start_date).getTime();
                    const diff = Math.abs(expectedStart - sStart);
                    return diff < 60000; // 60 seconds diff allowed
                });

                if (match) {
                    console.log(`Found matching subscription ${match.id} for payment ${payment.id}, cancelling...`);
                    await supabaseClient
                        .from('subscriptions')
                        .update({ status: 'cancelled' })
                        .eq('id', match.id);
                } else {
                    console.log(`No matching subscription found within 60s window. Payment Start: ${payment.coverage_start_date}`);
                }
            }

            // If type is 'all', check if we need to downgrade profile
            if (type === 'all') {
                const { count } = await supabaseClient
                    .from('subscriptions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', payment.user_id)
                    .eq('type', 'all')
                    .eq('status', 'active');

                if (count === 0) {
                    await supabaseClient.from('profiles').update({ subscription_tier: 'free' }).eq('id', payment.user_id);
                }
            }
        }

        return new Response(
            JSON.stringify(resultData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
