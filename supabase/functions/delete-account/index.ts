// Supabase Edge Function: delete-account
// Permanently deletes the calling user's account and ALL associated data,
// as if the user never existed.
//
// What gets removed:
//   1. Storage objects under `${userId}/` in the `avatars`,
//      `session-photos` and `purchase-photos` buckets
//      (admin.deleteUser does NOT touch storage).
//   2. The one non-cascading reference to the user
//      (`grove_invite_links.referred_user_id`), which would otherwise block
//      the auth-user delete.
//   3. The auth user itself via the Admin API. Every user-owned table
//      references `auth.users(id) ON DELETE CASCADE`, so this single delete
//      cascades to: profiles, focus_sessions, session_tags, focus_goals,
//      rewards, subscription_receipts, badges, user_settings,
//      blocklist_selections, referral_tracking, push_tokens, grove_profiles,
//      grove_privacy_settings, grove_friendships, grove_reactions,
//      grove_invite_links, grove_challenges, grove_challenge_participants,
//      shared_tag_links, shared_tag_memberships, heartbeat_settings,
//      heartbeat_inner_circle, heartbeat_notifications.
//
// Deployment: supabase functions deploy delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const STORAGE_BUCKETS = ['avatars', 'session-photos', 'purchase-photos'];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Remove every object under `${userId}/` in a bucket, including nested folders.
async function deleteBucketFolder(
  // deno-lint-ignore no-explicit-any
  admin: any,
  bucket: string,
  prefix: string
): Promise<void> {
  const { data: entries, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) {
    console.error(`Failed to list ${bucket}/${prefix}:`, error.message);
    return;
  }
  if (!entries || entries.length === 0) return;

  // Supabase returns a folder as an entry with a null `id`; recurse into it.
  const files: string[] = [];
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      await deleteBucketFolder(admin, bucket, path);
    } else {
      files.push(path);
    }
  }

  if (files.length > 0) {
    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(files);
    if (removeError) {
      console.error(`Failed to remove from ${bucket}:`, removeError.message);
    }
  }
}

// Notify the user's accepted inner circle members that the account is being
// deleted. Stores the display name in the text (not the id, which is about to
// be gone) and sends a push. Best-effort: failures here must not block the
// actual account deletion.
async function notifyInnerCircleOfDeletion(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string
): Promise<void> {
  try {
    const { data: profile } = await admin
      .from('grove_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle();

    const displayName = profile?.display_name || 'A friend';

    const { data: members } = await admin
      .from('heartbeat_inner_circle')
      .select('circle_member_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (!members || members.length === 0) return;

    const notificationText = `${displayName} has deleted their Bittersweet account.`;

    // about_user_id is NULL: the user no longer exists; the name lives in text.
    const notifications = members.map((m: { circle_member_id: string }) => ({
      target_user_id: m.circle_member_id,
      about_user_id: null,
      trigger_type: 'account_deleted',
      notification_text: notificationText,
    }));

    const { error: insertError } = await admin
      .from('heartbeat_notifications')
      .insert(notifications);
    if (insertError) {
      console.error('Failed to insert deletion notifications:', insertError.message);
    }

    // Push to members (best-effort).
    const memberIds = members.map((m: { circle_member_id: string }) => m.circle_member_id);
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .in('user_id', memberIds);

    if (tokens && tokens.length > 0) {
      const pushMessages = tokens.map((t: { expo_push_token: string }) => ({
        to: t.expo_push_token,
        sound: 'default',
        title: 'Inner Circle Alert',
        body: notificationText,
        data: { type: 'heartbeat_alert', triggerType: 'account_deleted' },
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
  } catch (err) {
    // Never let notification failure block account deletion.
    console.error('notifyInnerCircleOfDeletion error:', err);
  }
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

    // Authenticate the caller — a user can only delete their own account.
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

    const userId = user.id;

    // 1. Notify inner circle members BEFORE deleting — their alert keeps the
    //    user's display name (embedded in the text) but not the id, since the
    //    account is about to disappear. Must run first: the profile and
    //    inner-circle rows are cascade-deleted with the auth user.
    await notifyInnerCircleOfDeletion(admin, userId);

    // 2. Delete the user's storage objects (not covered by DB cascade).
    for (const bucket of STORAGE_BUCKETS) {
      await deleteBucketFolder(admin, bucket, userId);
    }

    // 3. Clear the only non-cascading reference to this user so the auth
    //    delete isn't blocked. These rows belong to the *referrer*; we keep
    //    the referrer's earned referral_tracking count intact and simply
    //    detach the now-deleted referred user.
    const { error: refError } = await admin
      .from('grove_invite_links')
      .update({ referred_user_id: null })
      .eq('referred_user_id', userId);
    if (refError) {
      console.error('Failed to detach referral links:', refError.message);
    }

    // 4. Delete the auth user — cascades to every user-owned table.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError.message);
      return jsonResponse(
        { error: 'Failed to delete account', detail: deleteError.message },
        500
      );
    }

    return jsonResponse({ status: 'success' }, 200);
  } catch (err) {
    console.error('delete-account error:', err);
    return jsonResponse(
      { error: 'Internal error', detail: String(err) },
      500
    );
  }
});
