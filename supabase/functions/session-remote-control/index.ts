// Supabase Edge Function: session-remote-control
//
// Makes the phone's Live Activity follow a session the desktop client started or
// stopped, including when the iOS app has been swiped away.
//
// Deployment: supabase functions deploy session-remote-control
// Requires:   supabase/migrations/20260820_device_push_tokens.sql
//             APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY secrets (see _shared/apns.ts)
//
// Body: { event: 'start' | 'stop' }
//
// Why a function at all, when Phase 2 already syncs `active_sessions` over
// Realtime: a websocket dies the moment the app is backgrounded or swiped away.
// A push does not, and a Live Activity is rendered by the system's widget
// extension rather than by the app, so the timer keeps running on the Lock
// Screen with no app process involved.
//
// This function does NOT tell the phone to start a *session* — no shield, no
// focus_sessions row, no fruits. It mirrors a timer. The desktop client owns
// the session it started while the phone was closed and writes its finished row
// itself (see useActiveSession.stop). Blocking apps remotely is Phase 4, which
// needs the widget extension entitled for Family Controls.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserLanguages, langOf, type Lang } from '../_shared/i18n.ts';
import { REMOTE_START_ALERT, labelsFor } from '../_shared/liveActivityCopy.ts';
import { isDeadToken, sendApnsPush } from '../_shared/apns.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Must match LiveActivityAttributes in the widget extension — APNs decodes the
// payload straight into that Swift type, and a name mismatch is a silent drop.
// The attributes struct is the pod's, not ours (node_modules/expo-live-activity/
// ios/LiveActivityAttributes.swift), which is why `name` is a fixed string.
const ATTRIBUTES_TYPE = 'LiveActivityAttributes';
const ATTRIBUTES_NAME = 'ExpoLiveActivity';

// Mirrors LA_COLORS in src/services/LiveActivityService.ts. A pushed activity
// must be indistinguishable from a locally-started one, so these two lists have
// to stay in step; they are the palette, not chrome tokens, and the widget reads
// them as raw hex out of the attributes.
const LA_COLORS = {
  light: {
    backgroundColor: '#F5E6D3',
    titleColor: '#8B4513',
    subtitleColor: '#8B4513',
    progressViewLabelColor: '#8B4513',
  },
  dark: {
    backgroundColor: '#1B1C30',
    titleColor: '#FFFFFF',
    subtitleColor: '#CACACA',
    progressViewLabelColor: '#FFFFFF',
  },
} as const;
const PROGRESS_TINT = '#FF6347';

interface ActiveSessionRow {
  user_id: string;
  session_id: string;
  tag_id: string;
  started_at: string;
  ended_at: string | null;
  target_minutes: number | null;
  origin: string;
  stopped_by: string | null;
}

interface TokenRow {
  token: string;
  activity_id: string | null;
  bundle_id: string;
  color_scheme: 'light' | 'dark' | null;
  updated_at: string;
}

/**
 * How long an update token can be trusted.
 *
 * ActivityKit ends a Live Activity on its own after eight hours, so a token last
 * seen before then addresses an activity that no longer exists. That matters
 * because the failure is silent rather than loud: Apple's rule is that "the
 * system ignores an ActivityKit push notification if it arrives after the Live
 * Activity ended" — APNs still answers 200, so nothing tells us to fall back to
 * push-to-start, and a desktop start would just never appear on the phone. The
 * app deletes the row itself when it sees the activity end; this is the backstop
 * for when it wasn't running to notice.
 */
const UPDATE_TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * The running-timer content state, byte-for-byte what
 * LiveActivityService.startFocusTimer / startFocusTimerInfinite send.
 *
 * The two shapes differ in one deliberate way: an infinite session puts its
 * START time in `timerEndDateInMilliseconds` and omits
 * `timerStartDateInMilliseconds`. The widget reads a past end date as "count up
 * from here" and a future one as "count down to here"
 * (targets/LiveActivity/LiveActivityView.swift), so a single field drives both
 * directions. Don't "fix" this by also sending a start date for infinite
 * sessions — that branch is never reached and the field would be ignored.
 */
function activeContentState(
  session: ActiveSessionRow,
  tagLabel: string,
  lang: Lang
): Record<string, unknown> {
  const startedAtMs = new Date(session.started_at).getTime();
  const minutes = session.target_minutes ?? 0;
  const infinite = minutes <= 0;

  return {
    title: tagLabel,
    subtitle: infinite ? '∞ focus session' : `${minutes}m focus session`,
    timerEndDateInMilliseconds: infinite ? startedAtMs : startedAtMs + minutes * 60_000,
    ...(infinite ? {} : { timerStartDateInMilliseconds: startedAtMs }),
    imageName: 'app_icon',
    dynamicIslandImageName: 'app_icon',
    dynamicIslandText: tagLabel,
    ...labelsFor(lang),
  };
}

/**
 * The idle "Start" card, mirroring LiveActivityService.stopFocusTimer.
 *
 * `tagId` and `durationMinutes` are what the card's Start button needs —
 * StartSessionIntent reads them straight off the content state
 * (targets/HomeWidget/SessionIntent.swift) — so an ended remote session leaves
 * behind a card the user can restart from, exactly like a local one.
 */
function idleContentState(
  session: ActiveSessionRow,
  tagLabel: string,
  lang: Lang
): Record<string, unknown> {
  const minutes = session.target_minutes ?? 0;

  return {
    title: tagLabel,
    subtitle: minutes > 0 ? `${minutes} min` : '∞',
    imageName: 'app_icon',
    dynamicIslandImageName: 'app_icon',
    dynamicIslandText: tagLabel,
    isIdle: true,
    tagId: session.tag_id,
    durationMinutes: minutes,
    ...labelsFor(lang),
  };
}

/** Mirrors the LiveActivityConfig the app passes when it creates a focus activity. */
function attributesFor(colorScheme: 'light' | 'dark'): Record<string, unknown> {
  const palette = LA_COLORS[colorScheme];
  return {
    name: ATTRIBUTES_NAME,
    backgroundColor: palette.backgroundColor,
    titleColor: palette.titleColor,
    subtitleColor: palette.subtitleColor,
    progressViewTint: PROGRESS_TINT,
    progressViewLabelColor: palette.progressViewLabelColor,
    // Empty path → bare scheme "bittersweet-mobile://" → Focus tab, matching the app.
    deepLinkUrl: '',
    timerType: 'digital',
    // sessionType is left unset: only "unlock" is special-cased by the widget,
    // and this is always a focus session.
  };
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Invalid token' }, 401);

    const { event } = await req.json();
    if (event !== 'start' && event !== 'stop') {
      return json({ error: "event must be 'start' or 'stop'" }, 400);
    }

    // The live record is the single source of truth for what to push. The caller
    // sends only which transition it just made, never the session contents — a
    // client that could name its own start time could make the phone display a
    // session that never happened.
    const { data: sessionRow, error: sessionError } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) return json({ error: sessionError.message }, 500);
    if (!sessionRow) return json({ skipped: 'no active session record' });

    const session = sessionRow as ActiveSessionRow;

    // Only mirror what the *desktop* did. The phone already renders its own
    // sessions locally, and pushing one back at it would race the local activity
    // with an identical-but-slightly-later update for no benefit.
    if (event === 'start' && (session.ended_at || session.origin !== 'desktop')) {
      return json({ skipped: 'not a live desktop-started session' });
    }
    if (event === 'stop' && (!session.ended_at || session.stopped_by !== 'desktop')) {
      return json({ skipped: 'not a desktop stop' });
    }

    // Tag label: "🎯 Deep Work", the same string the app builds for the LA title.
    const { data: tagRow } = await supabase
      .from('session_tags')
      .select('name, icon')
      .eq('user_id', user.id)
      .eq('id', session.tag_id)
      .maybeSingle();
    const tagLabel = tagRow?.name ? `${tagRow.icon || '🎯'} ${tagRow.name}` : 'Focus';

    const languages = await fetchUserLanguages(supabase, [user.id]);
    const lang = langOf(languages, user.id);

    const { data: tokenRows } = await supabase
      .from('device_push_tokens')
      .select('kind, token, activity_id, bundle_id, color_scheme, updated_at')
      .eq('user_id', user.id)
      .in('kind', ['liveactivity', 'pushtostart'])
      .order('updated_at', { ascending: false });

    const rows = (tokenRows ?? []) as Array<TokenRow & { kind: string }>;
    const updateToken = rows.find(
      (r) =>
        r.kind === 'liveactivity' &&
        Date.now() - new Date(r.updated_at).getTime() < UPDATE_TOKEN_MAX_AGE_MS
    );
    // Push-to-start tokens have no such expiry — they belong to the app install,
    // not to any one activity, and stay valid until iOS reissues them.
    const startToken = rows.find((r) => r.kind === 'pushtostart');

    const timestamp = Math.floor(Date.now() / 1000);

    // When this session was always going to end. Drives two different clocks:
    // `stale-date` tells the widget when what it is showing has gone out of date
    // (the pod sets the same value locally — ExpoLiveActivityModule.swift), and
    // `apns-expiration` tells APNs when a still-undelivered push is pointless.
    // Null for an infinite session, which has neither.
    const startedAtSeconds = Math.floor(new Date(session.started_at).getTime() / 1000);
    const endsAtSeconds =
      session.target_minutes && session.target_minutes > 0
        ? startedAtSeconds + session.target_minutes * 60
        : null;
    const staleDate = endsAtSeconds ? { 'stale-date': endsAtSeconds } : {};

    const dropToken = async (token: string) => {
      await supabase.from('device_push_tokens').delete().eq('user_id', user.id).eq('token', token);
    };

    // ---- stop: end the activity, leaving the idle card as its final content ----
    //
    // This is the push equivalent of endAllFocusActivitiesWithState: `event:
    // "end"` with no `dismissal-date` uses ActivityKit's .default policy, which
    // drops the activity out of the Dynamic Island immediately but keeps the
    // Lock Screen banner for up to four hours — the behaviour the app settled on
    // to stop a finished session squatting in the Dynamic Island.
    if (event === 'stop') {
      if (!updateToken) return json({ skipped: 'no live activity token' });

      const result = await sendApnsPush({
        deviceToken: updateToken.token,
        bundleId: updateToken.bundle_id,
        pushType: 'liveactivity',
        priority: 10,
        // No `expiration` override: an end delivered late still matters, because
        // the alternative is a timer left running on the Lock Screen.
        collapseId: session.session_id,
        payload: {
          aps: {
            timestamp,
            event: 'end',
            'content-state': idleContentState(session, tagLabel, lang),
          },
        },
      });

      // The activity ended (or was dismissed) without the app being awake to
      // tell us, which is the normal outcome when the phone stayed closed.
      if (isDeadToken(result)) await dropToken(updateToken.token);

      return json({ event, sent: result.ok, via: 'update', apns: result });
    }

    // ---- start ----
    //
    // Preferred path: UPDATE an activity that is already on screen. The app keeps
    // an idle "Start" card alive whenever the user has picked a tag
    // (LiveActivityService.showIdleFocusActivity), and turning that card into a
    // running timer is both cheaper and quieter than creating one — no banner,
    // no new activity, and it matches what tapping Start on the phone does.
    if (updateToken) {
      const result = await sendApnsPush({
        deviceToken: updateToken.token,
        bundleId: updateToken.bundle_id,
        pushType: 'liveactivity',
        priority: 10,
        expiration: endsAtSeconds ?? undefined,
        collapseId: session.session_id,
        payload: {
          aps: {
            timestamp,
            event: 'update',
            'content-state': activeContentState(session, tagLabel, lang),
            ...staleDate,
          },
        },
      });

      if (result.ok) return json({ event, sent: true, via: 'update', apns: result });

      // A dead update token means the activity ended while the app was closed —
      // fall through and create a new one instead of giving up.
      if (isDeadToken(result)) await dropToken(updateToken.token);
      else return json({ event, sent: false, via: 'update', apns: result });
    }

    // Fallback: push-to-start. Creates a Live Activity on a phone whose app is
    // backgrounded or force-quit — the whole point of Phase 3. iOS 17.2+ only,
    // and Apple requires an `alert`, so this is the one path the user sees a
    // banner for.
    if (!startToken) return json({ skipped: 'no push-to-start token' });

    const alert = REMOTE_START_ALERT[lang];
    const result = await sendApnsPush({
      deviceToken: startToken.token,
      bundleId: startToken.bundle_id,
      pushType: 'liveactivity',
      priority: 10,
      expiration: endsAtSeconds ?? undefined,
      collapseId: session.session_id,
      payload: {
        aps: {
          timestamp,
          event: 'start',
          'attributes-type': ATTRIBUTES_TYPE,
          attributes: attributesFor(startToken.color_scheme ?? 'light'),
          'content-state': activeContentState(session, tagLabel, lang),
          // No `sound`: the alert is mandatory, drawing attention to it is not.
          // The banner already lights the screen; a chime on top of that is the
          // kind of interruption this app exists to reduce.
          alert: { title: alert.title, body: alert.body },
          ...staleDate,
        },
      },
    });

    if (isDeadToken(result)) await dropToken(startToken.token);

    return json({ event, sent: result.ok, via: 'push-to-start', apns: result });
  } catch (error) {
    console.error('session-remote-control error:', error);
    return json({ error: String(error) }, 500);
  }
});
