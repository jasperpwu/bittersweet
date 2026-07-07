// Supabase Edge Function: gift-notify
// Sends a push to the other party of a gift reward when something happens:
//   created   — sender made a gift          → notify the recipient
//   purchased — recipient bought the gift   → notify the sender
//   photo_set — either party added a photo  → notify the other party
//
// Push-only (no DB notification rows). Invoked fire-and-forget by the
// client right after each mutation succeeds.
//
// Deployment: supabase functions deploy gift-notify
//
// Body: { giftId: string, event: 'created' | 'purchased' | 'photo_set' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const VALID_EVENTS = ['created', 'purchased', 'photo_set'] as const;
type GiftEvent = (typeof VALID_EVENTS)[number];

const PUSH_TITLE: Record<GiftEvent, string> = {
  created: "You've got a gift 🎀",
  purchased: 'Gift redeemed 🎉',
  photo_set: 'Gift moment captured 📸',
};

const PUSH_BODY: Record<GiftEvent, (name: string, giftName: string) => string> = {
  created: (name, giftName) => `${name} sent you "${giftName}" in the fruit store!`,
  purchased: (name, giftName) =>
    `${name} bought your gift "${giftName}" — time to capture the moment!`,
  photo_set: (name, giftName) => `${name} added a photo to "${giftName}".`,
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    const { giftId, event } = await req.json();

    if (!giftId || !VALID_EVENTS.includes(event)) {
      return jsonResponse({ error: 'Invalid giftId or event' }, 400);
    }

    const { data: gift, error: giftError } = await supabase
      .from('gift_rewards')
      .select('id, sender_id, recipient_id, name')
      .eq('id', giftId)
      .maybeSingle();

    if (giftError || !gift) {
      return jsonResponse({ error: 'Gift not found' }, 404);
    }

    // Who may fire each event, and who gets notified.
    let targetUserId: string;
    if (event === 'created') {
      if (user.id !== gift.sender_id) {
        return jsonResponse({ error: 'Only the sender can announce a gift' }, 403);
      }
      targetUserId = gift.recipient_id;
    } else if (event === 'purchased') {
      if (user.id !== gift.recipient_id) {
        return jsonResponse({ error: 'Only the recipient can announce a purchase' }, 403);
      }
      targetUserId = gift.sender_id;
    } else {
      if (user.id !== gift.sender_id && user.id !== gift.recipient_id) {
        return jsonResponse({ error: 'Not a party of this gift' }, 403);
      }
      targetUserId = user.id === gift.sender_id ? gift.recipient_id : gift.sender_id;
    }

    // Caller's display name for the copy
    const { data: profile, error: profileError } = await supabase
      .from('grove_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', targetUserId);

    if (tokensError || !tokens || tokens.length === 0) {
      return jsonResponse({ success: true, skipped: true, reason: 'no_push_tokens' }, 200);
    }

    const pushMessages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: PUSH_TITLE[event as GiftEvent],
      body: PUSH_BODY[event as GiftEvent](profile.display_name, gift.name),
      data: { type: 'gift', event, giftId },
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      });
    } catch (pushError) {
      console.error('Push notification send error:', pushError);
      return jsonResponse({ error: 'Push send failed' }, 500);
    }

    return jsonResponse({ success: true, notified: tokens.length }, 200);
  } catch (error) {
    console.error('Gift notify error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
