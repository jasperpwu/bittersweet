// A direct APNs client, because Expo Push Service cannot send what we need.
//
// Every other notification in this project posts to exp.host/--/api/v2/push/send.
// That endpoint only sends `apns-push-type: alert`. Live Activity pushes are a
// different push type (`liveactivity`) on a different topic
// (`<bundle id>.push-type.liveactivity`) addressed with different tokens, and
// Expo has no way to express any of that — so this talks to APNs itself.
//
// Auth is token-based (JWT), not certificate-based: one APNs auth key (.p8) is
// team-wide and topic-agnostic, so the same key signs alert, liveactivity and
// (Phase 4) widgets pushes for every bundle ID on the team.
//
// Required secrets:
//   APNS_KEY_ID       the 10-character Key ID of the .p8
//   APNS_TEAM_ID      the 10-character Apple Developer Team ID
//   APNS_PRIVATE_KEY  the .p8 file contents, PEM including BEGIN/END lines
//   APNS_ENV          optional: 'production' | 'sandbox' | 'auto' (default 'auto')
//
// Set them with:
//   supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_ENV=auto
//   supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"

const PROD_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';

/**
 * How long a provider token is reused.
 *
 * APNs rejects a token older than one hour (ExpiredProviderToken) AND rejects a
 * provider that mints them too eagerly (TooManyProviderTokenUpdates, roughly
 * more than once per 20 minutes). 50 minutes sits inside both bounds.
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;

export type ApnsPushType = 'alert' | 'liveactivity' | 'widgets';

export interface ApnsResult {
  ok: boolean;
  status: number;
  /** APNs `reason` string, e.g. 'BadDeviceToken'. Absent on success. */
  reason?: string;
  /** Which environment finally accepted (or last rejected) the request. */
  environment: 'production' | 'sandbox';
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/** PEM (`-----BEGIN PRIVATE KEY-----` …) → raw PKCS#8 DER bytes. */
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;

async function signingKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const pem = Deno.env.get('APNS_PRIVATE_KEY');
  if (!pem) throw new Error('APNS_PRIVATE_KEY is not set');

  // .p8 files from Apple are PKCS#8-wrapped ECDSA P-256 keys.
  cachedKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  return cachedKey;
}

let cachedJwt: { token: string; mintedAt: number } | null = null;

/**
 * The `bearer` provider token APNs authenticates us with.
 *
 * Cached across invocations for as long as the isolate lives; a cold start just
 * mints a new one, which is well within APNs' update limit.
 */
export async function providerToken(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.mintedAt < TOKEN_TTL_MS) return cachedJwt.token;

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!keyId) throw new Error('APNS_KEY_ID is not set');
  if (!teamId) throw new Error('APNS_TEAM_ID is not set');

  const header = base64UrlEncodeJson({ alg: 'ES256', kid: keyId });
  const claims = base64UrlEncodeJson({ iss: teamId, iat: Math.floor(now / 1000) });
  const signingInput = `${header}.${claims}`;

  // WebCrypto returns ECDSA signatures as raw r‖s, which is exactly the JWS
  // encoding ES256 wants — no DER unwrapping needed.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey(),
    new TextEncoder().encode(signingInput)
  );

  const token = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  cachedJwt = { token, mintedAt: now };
  return token;
}

/** Reasons that mean "right payload, wrong APNs environment" — worth one retry. */
const WRONG_ENVIRONMENT_REASONS = new Set([
  'BadDeviceToken',
  'BadEnvironmentKeyInToken',
  'DeviceTokenNotForTopic',
]);

async function postToApns(
  host: string,
  deviceToken: string,
  headers: Record<string, string>,
  payload: unknown
): Promise<{ status: number; reason?: string }> {
  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: { ...headers, authorization: `bearer ${await providerToken()}` },
    body: JSON.stringify(payload),
  });

  // 200 has an empty body; failures carry {"reason": "..."}.
  if (response.status === 200) {
    await response.body?.cancel();
    return { status: 200 };
  }

  const text = await response.text();
  let reason: string | undefined;
  try {
    reason = JSON.parse(text)?.reason;
  } catch {
    reason = text || undefined;
  }
  return { status: response.status, reason };
}

/**
 * Send one push to one device token.
 *
 * The environment is resolved by trying and falling back rather than being
 * configured, because a token's environment is a property of the *build* that
 * produced it: the expo-live-activity plugin hardcodes `aps-environment:
 * development` (node_modules/expo-live-activity/plugin/src/withPushNotifications.ts),
 * so a locally-installed dev build yields sandbox tokens while a TestFlight or
 * App Store build yields production ones — and both users hit this same
 * function. Set APNS_ENV to skip the probe once a deployment only ever sees one.
 */
export async function sendApnsPush(params: {
  deviceToken: string;
  /** Bare bundle ID; the push-type suffix is appended here. */
  bundleId: string;
  pushType: ApnsPushType;
  /** 10 = deliver immediately. 5 = let the system schedule it (power-friendly). */
  priority?: 5 | 10;
  payload: unknown;
  /**
   * Unix seconds after which APNs stops trying. Defaults to one hour.
   *
   * Not 0 ("deliver once, never store"), which would be wrong for this traffic:
   * a Live Activity payload carries absolute timestamps, so one delivered after
   * a phone comes back online still renders the correct remaining time — and an
   * `end` that gets dropped leaves a timer running on the Lock Screen until
   * ActivityKit's own timeout. Pass the session's end time to stop pushing an
   * update nobody needs any more.
   */
  expiration?: number;
  /**
   * APNs replaces any still-stored push carrying the same collapse ID. Keyed on
   * the session, this means a stop supersedes a start the phone never received
   * rather than both arriving back to back.
   */
  collapseId?: string;
}): Promise<ApnsResult> {
  const {
    deviceToken,
    bundleId,
    pushType,
    priority = 10,
    payload,
    expiration,
    collapseId,
  } = params;

  const topic = pushType === 'alert' ? bundleId : `${bundleId}.push-type.${pushType}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'apns-push-type': pushType,
    'apns-topic': topic,
    'apns-priority': String(priority),
    'apns-expiration': String(expiration ?? Math.floor(Date.now() / 1000) + 3600),
  };
  if (collapseId) headers['apns-collapse-id'] = collapseId;

  const configured = Deno.env.get('APNS_ENV') ?? 'auto';
  const order: Array<'production' | 'sandbox'> =
    configured === 'production'
      ? ['production']
      : configured === 'sandbox'
        ? ['sandbox']
        : ['production', 'sandbox'];

  let last: ApnsResult = { ok: false, status: 0, environment: order[0] };

  for (const environment of order) {
    const host = environment === 'production' ? PROD_HOST : SANDBOX_HOST;
    const { status, reason } = await postToApns(host, deviceToken, headers, payload);

    if (status === 200) return { ok: true, status, environment };

    last = { ok: false, status, reason, environment };
    if (!reason || !WRONG_ENVIRONMENT_REASONS.has(reason)) break;
  }

  return last;
}

/**
 * True when APNs is telling us this token is dead rather than that the request
 * was wrong — the caller should delete the row instead of retrying it forever.
 *
 * Only meaningful after both environments have been tried, which `sendApnsPush`
 * does on its own; a `BadDeviceToken` surviving that probe really is a bad token.
 */
export function isDeadToken(result: ApnsResult): boolean {
  if (result.status === 410) return true; // Unregistered
  return result.status === 400 && result.reason === 'BadDeviceToken';
}
