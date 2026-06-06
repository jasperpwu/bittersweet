// Supabase Edge Function: apple-server-notifications
// Receives Apple App Store Server Notifications V2, verifies the JWS payload,
// and updates subscription state in the profiles table.
//
// Deployment: supabase functions deploy apple-server-notifications
// App Store Connect: Set V2 notification URL to:
//   https://<project-ref>.supabase.co/functions/v1/apple-server-notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  compactVerify,
  importX509,
  decodeProtectedHeader,
  base64url,
} from 'https://deno.land/x/jose@v5.2.3/index.ts';

// Apple Root CA - G3 certificate (DER, base64-encoded)
// Downloaded from https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
// This is used to pin the root of Apple's certificate chain.
const APPLE_ROOT_CA_G3_FINGERPRINT =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// --- Certificate Utilities ---

function derToPem(derBase64: string): string {
  const lines = derBase64.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- JWS Verification ---

async function verifyAppleJWS(signedPayload: string): Promise<any> {
  // 1. Decode the protected header to get x5c certificate chain
  const header = await decodeProtectedHeader(signedPayload);
  const x5c = header.x5c;

  if (!x5c || x5c.length < 3) {
    throw new Error('Missing or incomplete x5c certificate chain');
  }

  // 2. Verify the root certificate matches Apple Root CA - G3
  const rootDer = base64ToBytes(x5c[x5c.length - 1]);
  const rootFingerprint = await sha256Hex(rootDer);

  if (rootFingerprint !== APPLE_ROOT_CA_G3_FINGERPRINT) {
    throw new Error(
      `Root certificate fingerprint mismatch: ${rootFingerprint}`
    );
  }

  // 3. Import the leaf certificate and verify the JWS signature
  const leafPem = derToPem(x5c[0]);
  const publicKey = await importX509(leafPem, 'ES256');

  const { payload } = await compactVerify(signedPayload, publicKey);
  return JSON.parse(new TextDecoder().decode(payload));
}

// --- Subscription State Management ---

interface TransactionInfo {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  bundleId: string;
  expiresDate?: number;
  environment: string;
  type: string;
}

interface RenewalInfo {
  autoRenewStatus: number;
  autoRenewProductId: string;
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
}

async function activateSubscription(
  supabase: any,
  userId: string,
  txInfo: TransactionInfo,
  renewalInfo: RenewalInfo | null,
  status: string
) {
  // Update profile to premium
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: 'premium',
      membership_source: 'app_store',
      app_store_status: status,
      original_transaction_id: txInfo.originalTransactionId,
      subscription_expires_at: txInfo.expiresDate
        ? new Date(txInfo.expiresDate).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Profile activation error:', profileError);
  }

  // Upsert receipt
  await upsertReceipt(supabase, userId, txInfo, renewalInfo, status);
}

async function deactivateSubscription(
  supabase: any,
  userId: string,
  txInfo: TransactionInfo,
  renewalInfo: RenewalInfo | null,
  status: string
) {
  // Check membership_source — only downgrade App Store subscriptions
  const { data: profile } = await supabase
    .from('profiles')
    .select('membership_source')
    .eq('id', userId)
    .single();

  if (profile?.membership_source && profile.membership_source !== 'app_store') {
    console.log(
      `Skipping deactivation for user ${userId} — membership_source is '${profile.membership_source}'`
    );
    // Still update app_store_status to track the Apple state
    await supabase
      .from('profiles')
      .update({
        app_store_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    await upsertReceipt(supabase, userId, txInfo, renewalInfo, status);
    return;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: 'free',
      membership_source: 'none',
      app_store_status: status,
      subscription_expires_at: txInfo.expiresDate
        ? new Date(txInfo.expiresDate).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Profile deactivation error:', profileError);
  }

  await upsertReceipt(supabase, userId, txInfo, renewalInfo, status);
}

async function updateStatus(
  supabase: any,
  userId: string,
  txInfo: TransactionInfo,
  renewalInfo: RenewalInfo | null,
  status: string
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      app_store_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Status update error:', error);
  }

  await upsertReceipt(supabase, userId, txInfo, renewalInfo, status);
}

async function upsertReceipt(
  supabase: any,
  userId: string,
  txInfo: TransactionInfo,
  renewalInfo: RenewalInfo | null,
  status: string
) {
  const { error } = await supabase
    .from('subscription_receipts')
    .upsert(
      {
        user_id: userId,
        product_id: txInfo.productId,
        original_transaction_id: txInfo.originalTransactionId,
        expires_date: txInfo.expiresDate
          ? new Date(txInfo.expiresDate).toISOString()
          : null,
        environment: txInfo.environment,
        status,
        renewal_info: renewalInfo,
        last_verified_at: new Date().toISOString(),
        raw_receipt: {
          transactionId: txInfo.transactionId,
          productId: txInfo.productId,
          platform: 'ios',
          source: 'server_notification',
        },
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Receipt upsert error:', error);
  }
}

// --- Find User by Original Transaction ID ---

async function findUserByTransactionId(
  supabase: any,
  originalTransactionId: string
): Promise<string | null> {
  // First check subscription_receipts
  const { data: receipt } = await supabase
    .from('subscription_receipts')
    .select('user_id')
    .eq('original_transaction_id', originalTransactionId)
    .single();

  if (receipt?.user_id) return receipt.user_id;

  // Fallback: check profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('original_transaction_id', originalTransactionId)
    .single();

  return profile?.id ?? null;
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse the request body
    const body = await req.json();
    const { signedPayload } = body;

    if (!signedPayload) {
      return new Response(
        JSON.stringify({ error: 'Missing signedPayload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify and decode the outer JWS
    const notification = await verifyAppleJWS(signedPayload);
    console.log(
      'Notification:',
      notification.notificationType,
      notification.subtype ?? ''
    );

    const { notificationType, subtype, data } = notification;

    // TEST notifications have no data payload
    if (notificationType === 'TEST') {
      console.log('Received TEST notification — acknowledging');
      return new Response(JSON.stringify({ success: true, type: 'TEST' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data?.signedTransactionInfo) {
      console.log('No transaction info in notification — skipping');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify and decode nested JWS payloads
    const txInfo: TransactionInfo = await verifyAppleJWS(
      data.signedTransactionInfo
    );
    const renewalInfo: RenewalInfo | null = data.signedRenewalInfo
      ? await verifyAppleJWS(data.signedRenewalInfo)
      : null;

    // Verify bundle ID
    const expectedBundleId = Deno.env.get('APPLE_BUNDLE_ID');
    if (expectedBundleId && txInfo.bundleId !== expectedBundleId) {
      console.error(
        `Bundle ID mismatch: expected ${expectedBundleId}, got ${txInfo.bundleId}`
      );
      return new Response(
        JSON.stringify({ error: 'Bundle ID mismatch' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find the user associated with this transaction
    const userId = await findUserByTransactionId(
      supabase,
      txInfo.originalTransactionId
    );

    if (!userId) {
      console.error(
        `No user found for originalTransactionId: ${txInfo.originalTransactionId}`
      );
      // Return 200 so Apple doesn't retry — we simply don't have this user
      return new Response(
        JSON.stringify({ success: true, note: 'User not found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Route by notification type
    switch (notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
      case 'OFFER_REDEEMED':
        await activateSubscription(
          supabase,
          userId,
          txInfo,
          renewalInfo,
          'active'
        );
        break;

      case 'DID_FAIL_TO_RENEW': {
        const status =
          subtype === 'GRACE_PERIOD' ? 'grace_period' : 'billing_retry';
        await updateStatus(supabase, userId, txInfo, renewalInfo, status);
        break;
      }

      case 'EXPIRED':
      case 'GRACE_PERIOD_EXPIRED':
        await deactivateSubscription(
          supabase,
          userId,
          txInfo,
          renewalInfo,
          'expired'
        );
        break;

      case 'REFUND':
        await deactivateSubscription(
          supabase,
          userId,
          txInfo,
          renewalInfo,
          'refunded'
        );
        break;

      case 'REVOKE':
        await deactivateSubscription(
          supabase,
          userId,
          txInfo,
          renewalInfo,
          'revoked'
        );
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
      case 'DID_CHANGE_RENEWAL_PREF':
      case 'PRICE_INCREASE':
      case 'RENEWAL_EXTENDED':
      case 'RENEWAL_EXTENSION':
      case 'REFUND_DECLINED':
      case 'REFUND_REVERSED':
        // Log-only events — update receipt but don't change tier
        await upsertReceipt(
          supabase,
          userId,
          txInfo,
          renewalInfo,
          data.status?.toString() ?? 'unknown'
        );
        break;

      default:
        console.log(`Unhandled notification type: ${notificationType}`);
    }

    console.log(
      `Processed ${notificationType} for user ${userId} (txn: ${txInfo.originalTransactionId})`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Apple notification processing error:', error);
    // Return 500 so Apple retries the notification
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
