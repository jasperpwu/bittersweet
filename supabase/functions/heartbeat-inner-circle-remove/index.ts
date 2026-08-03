// Supabase Edge Function: heartbeat-inner-circle-remove
// Removes a member from the caller's inner circle and notifies that member.
//
// Only the circle owner (heartbeat_inner_circle.user_id) may remove a row.
// When the removed membership was 'accepted', the removed member receives a
// heartbeat notification + push ("<owner> removed you from their inner
// circle."). Withdrawing a still-'pending' invite removes silently — the
// invitee never joined, matching accept/decline which also don't notify.
//
// Runs server-side (service role) because inserting a notification row that
// targets another user and reading their push token both bypass RLS.
//
// Deployment: supabase functions deploy heartbeat-inner-circle-remove
// Body: { memberId: string }  // heartbeat_inner_circle row id

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserLanguages, langOf, format } from '../_shared/i18n.ts';
import { ALERT_TITLE, HEARTBEAT_TEXT, SOMEONE } from '../_shared/heartbeatCopy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number): Response {
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
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authenticate the caller.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    const { memberId } = await req.json();
    if (!memberId || typeof memberId !== 'string') {
      return jsonResponse({ error: 'memberId is required' }, 400);
    }

    // Load the membership and verify the caller owns it.
    const { data: membership, error: membershipError } = await admin
      .from('heartbeat_inner_circle')
      .select('id, user_id, circle_member_id, status')
      .eq('id', memberId)
      .maybeSingle();

    if (membershipError) {
      console.error('Membership fetch error:', membershipError.message);
      return jsonResponse({ error: 'Failed to load membership' }, 500);
    }
    if (!membership) {
      return jsonResponse({ error: 'Membership not found' }, 404);
    }
    if (membership.user_id !== user.id) {
      return jsonResponse({ error: 'Not the circle owner' }, 403);
    }

    const wasAccepted = membership.status === 'accepted';

    // Remove the member.
    const { error: updateError } = await admin
      .from('heartbeat_inner_circle')
      .update({ status: 'removed' })
      .eq('id', memberId);

    if (updateError) {
      console.error('Membership update error:', updateError.message);
      return jsonResponse({ error: 'Failed to remove member' }, 500);
    }

    // Only an accepted member gets a "you were removed" alert. Best-effort:
    // notification failures must not fail the removal itself.
    if (wasAccepted) {
      try {
        const { data: profile } = await admin
          .from('grove_profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();

        const targetId = membership.circle_member_id;

        // Localize for the REMOVED member — they're the one reading this.
        const langs = await fetchUserLanguages(admin, [targetId]);
        const lang = langOf(langs, targetId);
        const displayName = profile?.display_name || SOMEONE[lang];
        const notificationText = format(HEARTBEAT_TEXT.circle_removed[lang], {
          name: displayName,
        });

        const { error: insertError } = await admin
          .from('heartbeat_notifications')
          .insert({
            target_user_id: targetId,
            about_user_id: user.id,
            trigger_type: 'circle_removed',
            notification_text: notificationText,
          });
        if (insertError) {
          console.error('Notification insert error:', insertError.message);
        }

        // Push to the removed member (best-effort).
        const { data: tokens } = await admin
          .from('push_tokens')
          .select('expo_push_token')
          .eq('user_id', targetId);

        if (tokens && tokens.length > 0) {
          const pushMessages = tokens.map((t: { expo_push_token: string }) => ({
            to: t.expo_push_token,
            sound: 'default',
            title: ALERT_TITLE[lang],
            body: notificationText,
            data: {
              type: 'heartbeat_alert',
              triggerType: 'circle_removed',
              aboutUserId: user.id,
            },
          }));

          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessages),
          });
        }
      } catch (notifyError) {
        // Non-fatal: the member was already removed.
        console.error('Removal notify error:', notifyError);
      }
    }

    return jsonResponse({ success: true, notified: wasAccepted }, 200);
  } catch (error) {
    console.error('heartbeat-inner-circle-remove error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
