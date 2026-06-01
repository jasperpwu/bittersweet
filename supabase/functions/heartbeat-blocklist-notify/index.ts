// Supabase Edge Function: heartbeat-inner-circle-notify
// Notifies inner circle members when a user edits their blocklist or pauses heartbeat.
//
// Deployment: supabase functions deploy heartbeat-blocklist-notify
//
// Body: { userId: string, triggerType: 'blocklist_edit' | 'heartbeat_paused' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const VALID_TRIGGERS = ['blocklist_edit', 'heartbeat_paused'] as const;
type TriggerType = (typeof VALID_TRIGGERS)[number];

const NOTIFICATION_TEXT: Record<TriggerType, (name: string) => string> = {
  blocklist_edit: (name) => `${name} made changes to their blocked apps.`,
  heartbeat_paused: (name) => `${name} is taking a break from their heartbeat.`,
};

const PUSH_TITLE: Record<TriggerType, string> = {
  blocklist_edit: 'Inner Circle Alert',
  heartbeat_paused: 'Inner Circle Alert',
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

    const notificationBody = NOTIFICATION_TEXT[triggerType as TriggerType](profile.display_name);

    // Insert notifications for each member
    const notifications = members.map((m) => ({
      target_user_id: m.circle_member_id,
      about_user_id: userId,
      trigger_type: triggerType,
      notification_text: notificationBody,
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

    // Send push notifications to members via Expo Push API
    const memberUserIds = members.map((m) => m.circle_member_id);
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .in('user_id', memberUserIds);

    if (!tokensError && tokens && tokens.length > 0) {
      const pushMessages = tokens.map((t) => ({
        to: t.expo_push_token,
        sound: 'default',
        title: PUSH_TITLE[triggerType as TriggerType],
        body: notificationBody,
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
