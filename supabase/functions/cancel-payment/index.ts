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

        const { imp_uid, merchant_uid, reason, cancel_amount, action, subscription_id, payment_id } = await req.json()

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

        // For regular cancellation, check IDs, but allow force cancel to proceed even if IDs are missing (to clean up DB)
        // We also check for 'payment_id' which is our internal ID
        if (!imp_uid && !merchant_uid && !payment_id && action !== 'force_cancel') {
            throw new Error('Missing imp_uid or merchant_uid')
        }

        let resultData = { status: 'unknown', message: 'Initialized' };
        let portOneSuccess = false;

        // Try PortOne Cancellation (if IDs exist)
        if (imp_uid || merchant_uid) {
            try {
                // Check if it's a V2 Payment (starts with 'pay_')
                const isV2 = imp_uid && imp_uid.startsWith('pay_');

                if (isV2) {
                    // 2a. V2 Cancellation
                    const PORTONE_API_SECRET = Deno.env.get('PORTONE_API_SECRET');
                    if (!PORTONE_API_SECRET) throw new Error("Server Configuration Error: PortOne API Secret is missing.");

                    const v2CancelResponse = await fetch(`https://api.portone.io/payments/${imp_uid}/cancel`, {
                        method: "POST",
                        headers: {
                            "Authorization": `PortOne ${PORTONE_API_SECRET}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ reason: reason || 'User requested cancellation' })
                    });

                    if (!v2CancelResponse.ok) {
                        const errorText = await v2CancelResponse.text();
                        if (errorText.includes('PAYMENT_ALREADY_CANCELLED')) {
                            console.log('Payment already cancelled (V2), proceeding');
                        } else {
                            throw new Error(`PortOne V2 Failed: ${errorText}`);
                        }
                    }
                    resultData = { status: 'cancelled', message: 'V2 Cancellation Successful' };

                } else {
                    // 2b. V1 Cancellation
                    const IMP_KEY = Deno.env.get('IMP_KEY') || '8817338050146283';
                    const IMP_SECRET = Deno.env.get('IMP_SECRET') || '81ftGc90jXZfuAARMfF2etd6pD0YRri1Un4TFqZN64qYnalg38dxud3P3fqBc6D5LO80A9FYJySE31KX';

                    const tokenResponse = await fetch("https://api.iamport.kr/users/getToken", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imp_key: IMP_KEY, imp_secret: IMP_SECRET }),
                    });

                    const tokenData = await tokenResponse.json();
                    if (tokenData.code !== 0) throw new Error(`Token Failed: ${tokenData.message}`);

                    const { access_token } = tokenData.response;

                    const cancelBody: any = { reason: reason || 'User requested cancellation' };
                    if (imp_uid) cancelBody.imp_uid = imp_uid;
                    if (merchant_uid) cancelBody.merchant_uid = merchant_uid;
                    if (cancel_amount) cancelBody.amount = cancel_amount;

                    const cancelResponse = await fetch("https://api.iamport.kr/payments/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": access_token },
                        body: JSON.stringify(cancelBody),
                    });

                    const cancelData = await cancelResponse.json();
                    if (cancelData.code !== 0) throw new Error(`V1 Cancel Failed: ${cancelData.message}`);

                    resultData = cancelData.response;
                }
                portOneSuccess = true;

            } catch (poError: any) {
                console.error("PortOne Cancellation Error:", poError);
                if (action === 'force_cancel' || reason?.includes('Force')) {
                    console.warn("Proceeding with Force Cancel despite PortOne error.");
                    resultData = { status: 'cancelled', message: `Force Cancelled. PortOne Error: ${poError.message}` };
                    portOneSuccess = true; // Treat as success for DB update purposes
                } else {
                    throw poError; // Re-throw if not forced
                }
            }
        } else {
            // No IDs but force cancel -> Treat as success to clean DB
            if (action === 'force_cancel') {
                portOneSuccess = true;
                resultData = { status: 'cancelled', message: 'Force Cancelled (No PG IDs)' };
            }
        }

        // 3. Update Supabase Database
        if (portOneSuccess || action === 'force_cancel') {
            // Cancel Payment Record
            const updateQuery = supabaseClient
                .from('payments')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                });

            if (imp_uid) updateQuery.eq('imp_uid', imp_uid);
            else if (merchant_uid) updateQuery.eq('merchant_uid', merchant_uid);
            else if (payment_id) updateQuery.eq('id', payment_id);
            else throw new Error("Could not identify payment record to cancel");

            const { error: payError } = await updateQuery;
            if (payError) throw payError;

            // Find and Cancel Subscription (Best Effort)
            const query = supabaseClient.from('payments').select('*');
            if (imp_uid) query.eq('imp_uid', imp_uid);
            else if (merchant_uid) query.eq('merchant_uid', merchant_uid);
            else if (payment_id) query.eq('id', payment_id);

            const { data: payment } = await query.maybeSingle();

            if (payment) {
                const typeStr = payment.plan_type || '';
                const [type] = typeStr.split('_');

                // Cancel valid subscriptions
                const { data: subs } = await supabaseClient
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', payment.user_id)
                    .eq('type', type || 'all')
                    .eq('status', 'active');

                if (subs) {
                    for (const sub of subs) {
                        // Check time window (60s)
                        const diff = Math.abs(new Date(payment.coverage_start_date).getTime() - new Date(sub.start_date).getTime());
                        if (diff < 60000 || action === 'force_cancel') { // Be more aggressive if force cancel
                            await supabaseClient.from('subscriptions').update({ status: 'cancelled' }).eq('id', sub.id);
                        }
                    }
                }

                // Update Profile if needed
                if (type === 'all') {
                    const { count } = await supabaseClient.from('subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', payment.user_id).eq('type', 'all').eq('status', 'active');
                    if (count === 0) await supabaseClient.from('profiles').update({ subscription_tier: 'free' }).eq('id', payment.user_id);
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
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
