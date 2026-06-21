import { supabase } from '../../config/supabase';

/**
 * DEV-ONLY: seed challenges directly in the cloud so the full result/claim flow can
 * be tested without invites, a second device, waiting for dates, or accruing hits.
 *
 * It seeds BOTH hit sources so the UI is consistent: the stored participant.hits
 * (used by the card, the per-individual result, and claim eligibility) AND backdated
 * focus_sessions (which get_challenge_period_details recomputes for the detail grid).
 *
 * Limitation: a second participant's focus_sessions can't be inserted from the client
 * (RLS only lets you write your own rows), so this seeds YOUR participation only. For
 * a multi-person Ranking, seed via the Supabase SQL editor with the service role.
 */

const TEST_TAG_ID = 'challenge-test';
const TEST_SESSION_PREFIX = 'test-';

export type SeedChallengeState = 'won_unclaimed' | 'won_claimed' | 'lost' | 'active';

const TARGET_MINUTES = 1; // low target so a single short session counts as a hit
const FRUIT_REWARD = 10;
const TOTAL_DAYS = 3;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function makeSessionId(): string {
  return `${TEST_SESSION_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Insert one daily test challenge in the requested end-state, plus matching backdated
 * sessions. Returns the new challenge id.
 */
export async function seedTestChallenge(state: SeedChallengeState): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const today = new Date();
  const isActive = state === 'active';

  // Active: spans today (not over). Finished states: ended yesterday so it's "over".
  const start = isActive ? addDays(today, -1) : addDays(today, -(TOTAL_DAYS - 1) - 1);
  const end = isActive ? addDays(today, 2) : addDays(today, -1);

  // total periods for the finished span is TOTAL_DAYS; "won" hits all of them.
  const myHits = isActive ? 1 : state === 'lost' ? 1 : TOTAL_DAYS;
  const claimed = state === 'won_claimed';

  // status 'active' so the auto-cancel cron (which only touches 'pending' rows) leaves
  // it alone; the client derives the real per-individual result from hits regardless.
  const { data: challenge, error: challengeErr } = await supabase
    .from('grove_challenges')
    .insert({
      creator_id: user.id,
      tag_id: TEST_TAG_ID,
      tag_name: 'Test Challenge',
      tag_icon: '🔥',
      period: 'daily',
      target_minutes: TARGET_MINUTES,
      start_date: toYMD(start),
      end_date: toYMD(end),
      fruit_reward: FRUIT_REWARD,
      status: 'active',
    })
    .select('id')
    .single();
  if (challengeErr) throw challengeErr;

  const { error: participantErr } = await supabase.from('grove_challenge_participants').insert({
    challenge_id: challenge.id,
    user_id: user.id,
    role: 'creator',
    status: 'accepted',
    hits: myHits,
    tag_id: TEST_TAG_ID,
    reward_claimed_at: claimed ? new Date().toISOString() : null,
  });
  if (participantErr) throw participantErr;

  // One backdated session per hit-day so the detail grid recomputes the same hits.
  const sessions = Array.from({ length: myHits }, (_, i) => {
    const day = addDays(start, i);
    const startTime = new Date(day);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + TARGET_MINUTES * 60_000);
    return {
      id: makeSessionId(),
      user_id: user.id,
      tag_id: TEST_TAG_ID,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration: TARGET_MINUTES,
    };
  });
  if (sessions.length > 0) {
    const { error: sessionErr } = await supabase.from('focus_sessions').insert(sessions);
    if (sessionErr) throw sessionErr;
  }

  return challenge.id as string;
}

/**
 * Remove every seeded test challenge (cascades participant rows) and the backdated
 * test sessions for the current user.
 */
export async function clearTestChallenges(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error: challengeErr } = await supabase
    .from('grove_challenges')
    .delete()
    .eq('creator_id', user.id)
    .eq('tag_id', TEST_TAG_ID);
  if (challengeErr) throw challengeErr;

  const { error: sessionErr } = await supabase
    .from('focus_sessions')
    .delete()
    .eq('user_id', user.id)
    .like('id', `${TEST_SESSION_PREFIX}%`);
  if (sessionErr) throw sessionErr;
}
