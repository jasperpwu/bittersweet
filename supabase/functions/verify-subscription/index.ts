// Supabase Edge Function: verify-subscription
// Receives a StoreKit 2 purchase and updates the user's subscription status.
//
// Deployment: supabase functions deploy verify-subscription
//
// For production, add Apple certificate chain verification of the JWS transaction.
// See: https://developer.apple.com/documentation/appstoreserverapi/jwstransaction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the JWT from the request to get the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { purchaseToken, productId, platform } = await req.json();

    if (!purchaseToken || !productId) {
      return new Response(
        JSON.stringify({ error: 'Missing purchaseToken or productId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: For production, verify the JWS transaction signature using Apple's
    // certificate chain. For now, we trust the client-provided data since
    // StoreKit 2 already validates on-device.

    // Upsert subscription receipt
    const { error: receiptError } = await supabase
      .from('subscription_receipts')
      .upsert(
        {
          user_id: user.id,
          product_id: productId,
          original_transaction_id: purchaseToken,
          raw_receipt: { purchaseToken, productId, platform },
        },
        { onConflict: 'user_id' }
      );

    if (receiptError) {
      console.error('Receipt upsert error:', receiptError);
    }

    // Update profile subscription tier
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'premium',
        original_transaction_id: purchaseToken,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, tier: 'premium' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Verify subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
