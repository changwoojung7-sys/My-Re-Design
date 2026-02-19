import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

        const { imp_uid, merchant_uid, mode, payment_id } = await req.json()

        // 1. V1 Verification (Test Mode / Classic)
        if (imp_uid) {
            // ... Existing V1 Logic ...
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
            const sandboxParam = mode === 'test' ? '?include_sandbox=true' : '';
            const requestUrl = `https://api.iamport.kr/payments/${imp_uid}${sandboxParam}`;
            const verifyResponse = await fetch(requestUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": access_token
                },
            });

            if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new Error(`PortOne API Error (${verifyResponse.status}): ${errorText}`);
            }

            const verifyData = await verifyResponse.json();
            if (verifyData.code !== 0) {
                throw new Error(`Payment verification failed (Code ${verifyData.code}): ${verifyData.message}`);
            }

            const paymentData = verifyData.response;

            // Strict Status Check for V1
            if (paymentData.status !== 'paid') {
                throw new Error(`Payment status is '${paymentData.status}', not 'paid'. verification failed.`);
            }

            return new Response(
                JSON.stringify({ success: true, payment: paymentData }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. V2 Verification (Real Mode)
        else if (payment_id) {
            // Need V2 API Secret for Server-Side Verification
            const PORTONE_API_SECRET = Deno.env.get('PORTONE_API_SECRET');

            if (!PORTONE_API_SECRET) {
                console.error("Critical Error: Missing PORTONE_API_SECRET in Supabase Secrets.");
                throw new Error("Server Configuration Error: Payment verification secret is missing.");
            }

            // Implementation for V2 Verification
            const v2VerifyResponse = await fetch(`https://api.portone.io/payments/${payment_id}`, {
                headers: {
                    "Authorization": `PortOne ${PORTONE_API_SECRET}`
                }
            });

            if (!v2VerifyResponse.ok) {
                const errorText = await v2VerifyResponse.text();
                throw new Error(`PortOne V2 API Error: ${errorText}`);
            }

            const paymentData = await v2VerifyResponse.json();

            // Check status
            // V2 API Status: PAID, CANCELLED, etc.
            if (paymentData.status !== 'PAID') {
                throw new Error(`Payment status is '${paymentData.status}', not 'PAID'. verification failed.`);
            }

            return new Response(
                JSON.stringify({ success: true, payment: paymentData }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        throw new Error('Missing imp_uid or payment_id');

    } catch (error: any) {
        console.error('Verify Payment Error:', error);
        // Return 200 OK with error details so the client can read the JSON body
        // (Supabase functions.invoke throws on non-2xx without parsing body)
        return new Response(
            JSON.stringify({ error: error.message, details: error.toString() }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
