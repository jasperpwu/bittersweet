// Supabase Edge Function: subscription-status-cron
// Daily cron that verifies active App Store subscriptions against Apple's API.
// Catches expired/revoked/refunded subscriptions that we may have missed via webhook.
//
// Intended to be called by an external cron scheduler (daily at 3:00 AM UTC).
// No auth required — uses service role key internally.
//
// Deployment: supabase functions deploy subscription-status-cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  importPKCS8,
  SignJWT,
  decodeProtectedHeader,
  compactVerify,
  importX509,
} from 'https://deno.land/x/jose@v5.2.3/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Apple Root CA - G3 fingerprint (SHA-256 of DER)
const APPLE_ROOT_CA_G3_FINGERPRINT =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

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

async function verifyAppleJWS(signedPayload: string): Promise<any> {
  const header = await decodeProtectedHeader(signedPayload);
  const x5c = header.x5c;

  if (!x5c || x5c.length < 3) {
    throw new Error('Missing or incomplete x5c certificate chain');
  }

  const rootDer = base64ToBytes(x5c[x5c.length - 1]);
  const rootFingerprint = await sha256Hex(rootDer);

  if (rootFingerprint !== APPLE_ROOT_CA_G3_FINGERPRINT) {
    throw new Error(
      `Root certificate fingerprint mismatch: ${rootFingerprint}`
    );
  }

  const leafPem = derToPem(x5c[0]);
  const publicKey = await importX509(leafPem, 'ES256');

  const { payload } = await compactVerify(signedPayload, publicKey);
  return JSON.parse(new TextDecoder().decode(payload));
}

// --- App Store Server API JWT ---

async function generateAppStoreJWT(): Promise<string> {
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY')!;
  const keyId = Deno.env.get('APPLE_KEY_ID')!;
  const issuerId = Deno.env.get('APPLE_ISSUER_ID')!;
  const bundleId = Deno.env.get('APPLE_BUNDLE_ID')!;

  const privateKey = await importPKCS8(privateKeyPem, 'ES256');

  return new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('appstoreconnect-v1')
    .sign(privateKey);
}

// --- Status Mapping ---

// Apple subscription status codes:
// 1 = Active, 2 = Expired, 3 = Billing Retry, 4 = Billing Grace Period, 5 = Revoked
function mapAppleStatus(status: number): string {
  switch (status) {
    case 1:
      return 'active';
    case 2:
      return 'expired';
    case 3:
      return 'billing_retry';
    case 4:
      return 'grace_period';
    case 5:
      return 'revoked';
    default:
      return 'unknown';
  }
}

function shouldDeactivate(status: number): boolean {
  // Expired (2), Revoked (5) = should deactivate
  return status === 2 || status === 5;
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

    // Query all active App Store subscribers
    const { data: subscribers, error: queryError } = await supabase
      .from('profiles')
      .select('id, original_transaction_id, membership_source')
      .eq('membership_source', 'app_store')
      .eq('subscription_tier', 'premium')
      .not('original_transaction_id', 'is', null);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(
        JSON.stringify({ error: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      console.log('No active App Store subscribers to check');
      return new Response(
        JSON.stringify({ success: true, checked: 0, updated: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Checking ${subscribers.length} active App Store subscribers`);

    const token = await generateAppStoreJWT();
    let updated = 0;
    let errors = 0;

    for (const subscriber of subscribers) {
      try {
        // Call App Store Server API
        // Try production first, fall back to sandbox
        let response = await fetch(
          `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${subscriber.original_transaction_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // 4040020 = OriginalTransactionIdNotFoundError, try sandbox
        if (response.status === 404) {
          response = await fetch(
            `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${subscriber.original_transaction_id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        }

        if (!response.ok) {
          console.error(
            `API error for user ${subscriber.id}: ${response.status} ${response.statusText}`
          );
          errors++;
          continue;
        }

        const apiData = await response.json();

        // Find the latest transaction status
        let latestStatus: number | null = null;
        let latestTxInfo: any = null;
        let latestRenewalInfo: any = null;

        for (const group of apiData.data ?? []) {
          for (const tx of group.lastTransactions ?? []) {
            // Use the status from the API response directly
            if (
              tx.originalTransactionId ===
              subscriber.original_transaction_id
            ) {
              latestStatus = tx.status;

              // Decode transaction and renewal info
              if (tx.signedTransactionInfo) {
                try {
                  latestTxInfo = await verifyAppleJWS(
                    tx.signedTransactionInfo
                  );
                } catch (e) {
                  console.error('Failed to verify transaction JWS:', e);
                }
              }
              if (tx.signedRenewalInfo) {
                try {
                  latestRenewalInfo = await verifyAppleJWS(
                    tx.signedRenewalInfo
                  );
                } catch (e) {
                  console.error('Failed to verify renewal JWS:', e);
                }
              }
              break;
            }
          }
        }

        if (latestStatus === null) {
          console.log(`No status found for user ${subscriber.id}`);
          continue;
        }

        const mappedStatus = mapAppleStatus(latestStatus);

        if (shouldDeactivate(latestStatus)) {
          // Deactivate — but protect referral/manual premium
          if (subscriber.membership_source !== 'app_store') {
            console.log(
              `Skipping deactivation for user ${subscriber.id} — source is '${subscriber.membership_source}'`
            );
            await supabase
              .from('profiles')
              .update({
                app_store_status: mappedStatus,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscriber.id);
          } else {
            await supabase
              .from('profiles')
              .update({
                subscription_tier: 'free',
                membership_source: 'none',
                app_store_status: mappedStatus,
                subscription_expires_at: latestTxInfo?.expiresDate
                  ? new Date(latestTxInfo.expiresDate).toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscriber.id);
          }
          updated++;
          console.log(
            `Deactivated user ${subscriber.id} — status: ${mappedStatus}`
          );
        } else {
          // Update status field (e.g., billing_retry, grace_period) without changing tier
          await supabase
            .from('profiles')
            .update({
              app_store_status: mappedStatus,
              subscription_expires_at: latestTxInfo?.expiresDate
                ? new Date(latestTxInfo.expiresDate).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriber.id);
        }

        // Update receipt record
        if (latestTxInfo) {
          await supabase
            .from('subscription_receipts')
            .upsert(
              {
                user_id: subscriber.id,
                product_id: latestTxInfo.productId,
                original_transaction_id:
                  latestTxInfo.originalTransactionId,
                expires_date: latestTxInfo.expiresDate
                  ? new Date(latestTxInfo.expiresDate).toISOString()
                  : null,
                environment: apiData.environment,
                status: mappedStatus,
                renewal_info: latestRenewalInfo,
                last_verified_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
        }

        // Rate limit: 100ms delay between API calls
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error checking subscription for user ${subscriber.id}:`,
          error
        );
        errors++;
      }
    }

    console.log(
      `Subscription cron complete: checked ${subscribers.length}, updated ${updated}, errors ${errors}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        checked: subscribers.length,
        updated,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription cron error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
