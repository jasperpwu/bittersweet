// Supabase Edge Function: heartbeat-inner-circle-notify
// Notifies inner circle members when a user edits their blocklist or pauses heartbeat.
//
// Deployment: supabase functions deploy heartbeat-blocklist-notify
//
// Body: { userId: string, triggerType: 'blocklist_edit' | 'blocklist_cleared' | 'heartbeat_paused' | 'threshold_changed' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserLanguages, langOf, format } from '../_shared/i18n.ts';
import { ALERT_TITLE, HEARTBEAT_TEXT } from '../_shared/heartbeatCopy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// This function owns four of the seven heartbeat triggers; the copy for all of
// them lives in _shared/heartbeatCopy.ts alongside the other functions'.
const VALID_TRIGGERS = [
  'blocklist_edit',
  'blocklist_cleared',
  'heartbeat_paused',
  'threshold_changed',
] as const;
type TriggerType = (typeof VALID_TRIGGERS)[number];

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

    const { userId, triggerType = 'blocklist_edit' } = await req.json();

    // Verify the requesting user matches the userId in the body
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'User mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate trigger type
    if (!VALID_TRIGGERS.includes(triggerType)) {
      return new Response(JSON.stringify({ error: 'Invalid triggerType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check heartbeat settings: must be enabled
    // Note: is_paused only gates the quiet-threshold cron (inactivity alerts).
    // Blocklist edits and pause notifications should always go through.
    const { data: settings, error: settingsError } = await supabase
      .from('heartbeat_settings')
      .select('is_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      console.error('Settings fetch error:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to check settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings || !settings.is_enabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'heartbeat_disabled' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the user's display name
    const { data: profile, error: profileError } = await supabase
      .from('grove_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get accepted inner circle members
    const { data: members, error: membersError } = await supabase
      .from('heartbeat_inner_circle')
      .select('circle_member_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (membersError) {
      console.error('Inner circle fetch error:', membersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch inner circle' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_inner_circle_members' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Members can each read a different language, so build the text per
    // recipient — it lands in both the stored row and the push body.
    const memberUserIds = members.map((m) => m.circle_member_id);
    const langs = await fetchUserLanguages(supabase, memberUserIds);
    const textFor = (memberId: string): string =>
      format(HEARTBEAT_TEXT[triggerType as TriggerType][langOf(langs, memberId)], {
        name: profile.display_name,
      });

    // Insert notifications for each member
    const notifications = members.map((m) => ({
      target_user_id: m.circle_member_id,
      about_user_id: userId,
      trigger_type: triggerType,
      notification_text: textFor(m.circle_member_id),
    }));

    const { error: insertError } = await supabase
      .from('heartbeat_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Notification insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create notifications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send push notifications to members via Expo Push API. user_id comes along
    // so each token can be matched back to its owner's language.
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', memberUserIds);

    if (!tokensError && tokens && tokens.length > 0) {
      const pushMessages = tokens.map((t) => ({
        to: t.expo_push_token,
        sound: 'default',
        title: ALERT_TITLE[langOf(langs, t.user_id)],
        body: textFor(t.user_id),
        data: { type: 'heartbeat_alert', triggerType, aboutUserId: userId },
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
        // Non-fatal: DB notifications were already inserted
        console.error('Push notification send error:', pushError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: members.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Heartbeat notify error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
