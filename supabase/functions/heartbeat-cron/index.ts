// Supabase Edge Function: heartbeat-cron
// Runs the heartbeat quiet-check and pause-expiry logic, then sends push
// notifications for any new alerts.
//
// Intended to be called by a cron schedule (pg_cron or external scheduler).
// No auth required — uses service role key internally.
//
// Deployment: supabase functions deploy heartbeat-cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserLanguages, langOf, format } from '../_shared/i18n.ts';
import { ALERT_TITLE, HEARTBEAT_TEXT } from '../_shared/heartbeatCopy.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

    const results = { quietAlerts: 0, pauseExpiries: 0, pushesSent: 0 };

    // ---- Step 1: Check pause expiry ----
    const { data: expiredPauses, error: expiryError } = await supabase
      .from('heartbeat_settings')
      .select('user_id')
      .eq('is_paused', true)
      .not('pause_expires_at', 'is', null)
      .lte('pause_expires_at', new Date().toISOString());

    if (expiryError) {
      console.error('Pause expiry fetch error:', expiryError);
    } else if (expiredPauses && expiredPauses.length > 0) {
      const expiredUserIds = expiredPauses.map((r) => r.user_id);
      const { error: updateError } = await supabase
        .from('heartbeat_settings')
        .update({
          is_paused: false,
          pause_duration: null,
          pause_started_at: null,
          pause_expires_at: null,
        })
        .in('user_id', expiredUserIds);

      if (updateError) {
        console.error('Pause expiry update error:', updateError);
      } else {
        results.pauseExpiries = expiredUserIds.length;
      }
    }

    // ---- Step 2: Check quiet threshold ----
    // Find users who are enabled, not paused, and past their threshold
    const { data: quietUsers, error: quietError } = await supabase
      .rpc('find_quiet_users');

    // We need an RPC because the interval arithmetic is complex.
    // If the RPC doesn't exist yet, fall back to a manual query.
    let usersToAlert: Array<{
      user_id: string;
      display_name: string;
      quiet_threshold_days: number;
    }> = [];

    if (quietError) {
      console.error('find_quiet_users RPC error, using fallback query:', quietError.message);

      // Fallback: fetch all enabled, non-paused settings and filter in JS
      const { data: allSettings, error: settingsErr } = await supabase
        .from('heartbeat_settings')
        .select('user_id, quiet_threshold_days, last_active_at')
        .eq('is_enabled', true)
        .eq('is_paused', false);

      if (!settingsErr && allSettings) {
        const now = Date.now();
        const candidates = allSettings.filter((s) => {
          const lastActive = new Date(s.last_active_at).getTime();
          const thresholdMs = s.quiet_threshold_days * 24 * 60 * 60 * 1000;
          return now - lastActive > thresholdMs;
        });

        if (candidates.length > 0) {
          // Check which ones haven't already been alerted
          const candidateIds = candidates.map((c) => c.user_id);

          const { data: existingAlerts } = await supabase
            .from('heartbeat_notifications')
            .select('about_user_id, sent_at')
            .in('about_user_id', candidateIds)
            .eq('trigger_type', 'quiet_threshold')
            .order('sent_at', { ascending: false });

          const alreadyAlerted = new Set<string>();
          if (existingAlerts) {
            for (const alert of existingAlerts) {
              const candidate = candidates.find((c) => c.user_id === alert.about_user_id);
              if (candidate && new Date(alert.sent_at) > new Date(candidate.last_active_at)) {
                alreadyAlerted.add(alert.about_user_id);
              }
            }
          }

          const filteredCandidates = candidates.filter((c) => !alreadyAlerted.has(c.user_id));

          if (filteredCandidates.length > 0) {
            // Fetch display names
            const { data: profiles } = await supabase
              .from('grove_profiles')
              .select('user_id, display_name')
              .in('user_id', filteredCandidates.map((c) => c.user_id));

            const profileMap = new Map(
              (profiles || []).map((p) => [p.user_id, p.display_name])
            );

            usersToAlert = filteredCandidates
              .filter((c) => profileMap.has(c.user_id))
              .map((c) => ({
                user_id: c.user_id,
                display_name: profileMap.get(c.user_id)!,
                quiet_threshold_days: c.quiet_threshold_days,
              }));
          }
        }
      }
    } else if (quietUsers) {
      usersToAlert = quietUsers;
    }

    // For each quiet user, create notifications for their inner circle and send pushes
    for (const quietUser of usersToAlert) {
      const { data: circleMembers } = await supabase
        .from('heartbeat_inner_circle')
        .select('circle_member_id')
        .eq('user_id', quietUser.user_id)
        .eq('status', 'accepted');

      if (!circleMembers || circleMembers.length === 0) continue;

      const memberIds = circleMembers.map((m) => m.circle_member_id);

      // Members of one circle can each read a different language, so the alert
      // text is built per recipient rather than once per quiet user.
      const langs = await fetchUserLanguages(supabase, memberIds);
      const textFor = (memberId: string): string =>
        format(HEARTBEAT_TEXT.quiet_threshold[langOf(langs, memberId)], {
          name: quietUser.display_name,
          days: quietUser.quiet_threshold_days,
        });

      // Insert DB notifications
      const notifications = memberIds.map((memberId) => ({
        target_user_id: memberId,
        about_user_id: quietUser.user_id,
        trigger_type: 'quiet_threshold',
        notification_text: textFor(memberId),
      }));

      const { error: insertError } = await supabase
        .from('heartbeat_notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Notification insert error for user', quietUser.user_id, insertError);
        continue;
      }

      results.quietAlerts += memberIds.length;

      // Send push notifications
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('user_id, expo_push_token')
        .in('user_id', memberIds);

      if (tokens && tokens.length > 0) {
        const pushMessages = tokens.map((t) => ({
          to: t.expo_push_token,
          sound: 'default',
          title: ALERT_TITLE[langOf(langs, t.user_id)],
          body: textFor(t.user_id),
          data: {
            type: 'heartbeat_alert',
            triggerType: 'quiet_threshold',
            aboutUserId: quietUser.user_id,
          },
        }));

        try {
          await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessages),
          });
          results.pushesSent += pushMessages.length;
        } catch (pushError) {
          console.error('Push send error:', pushError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Heartbeat cron error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
