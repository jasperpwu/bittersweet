/**
 * Challenge reward math.
 *
 * A challenge no longer pays a flat bounty. It doubles the fruits you actually
 * earned with the challenge tag while the challenge was running:
 *
 *   reward = fruits earned with the challenge tag between start and end date
 *            × multiplier
 *
 * The multiplier has a deliberate cliff at 100%:
 *   - every period hit          → ×1.00  (a full 100% double)
 *   - anything short of that    → ratio × 0.80  (prorated against an 80% band)
 *
 * So 80% completion pays 0.8 × 0.8 = 0.64 — 64 fruits on a 100-fruit base — and
 * only a perfect run gets the undiscounted double.
 *
 * `rewardMode` decides whose record feeds `ratio`:
 *   - `isolated` — my own hits only. My reward is mine to win or lose.
 *   - `pooled`   — the whole group is bound together. The full ×1.00 double is
 *                  paid only if EVERY accepted participant hit EVERY period; if
 *                  anyone falls short the group's average completion is used and
 *                  everyone drops into the 80% band. Note the base stays each
 *                  participant's own fruits — pooling binds the multiplier, not
 *                  the earnings, so nobody's fruits are redistributed.
 *
 * Pooled adds an unconditional perfect-run bonus on top: hit every period
 * yourself and you add +10% of your own fruits, whatever the group did. It is a
 * separate line in the payout rather than a multiplier tweak, so the shared
 * multiplier stays one number everyone can compare. Because it stacks even when
 * the group is perfect, pooled tops out at ×1.10 against isolated's ×1.00 —
 * deliberate, since pooled is the mode where someone else can cost you.
 *
 * The base is computed from LOCAL sessions: per-session fruits are not synced to
 * the cloud (migration 20260620), so only the owning device can total them. This
 * matches the existing trust-the-client model for challenge hits (20260606) —
 * `claim_challenge_reward` records whatever amount the client computed, guarded
 * by `reward_claimed_at` so it can only ever happen once.
 */

import { sessionFruits } from './fruitMath';
import type { ChallengeItem } from '../services/grove/GroveChallengeService';

/** Completion short of 100% is prorated against this band, not against a full double. */
export const CHALLENGE_PARTIAL_BAND = 0.8;

/** Pooled only: share of your own fruits added for personally hitting every period. */
export const CHALLENGE_PERFECT_BONUS = 0.1;

export interface ChallengeRewardBreakdown {
  /** Fruits earned with the challenge tag inside the challenge window. */
  baseFruits: number;
  /** 0–1 completion, per the challenge's reward mode. */
  ratio: number;
  /** 0–1 payout multiplier applied to `baseFruits`. */
  multiplier: number;
  /** Whole fruits claimable, perfect-run bonus included. */
  reward: number;
  /** Fruits from the pooled perfect-run bonus alone; 0 when it does not apply. */
  perfectBonus: number;
  /**
   * What the perfect-run bonus is worth right now whether or not it is earned,
   * so the UI can show it as a live target mid-challenge. 0 outside pooled mode.
   */
  potentialPerfectBonus: number;
  /** True when the pooled perfect-run bonus was earned. */
  earnedPerfectBonus: boolean;
  /** True when the full, undiscounted double was earned. */
  isFull: boolean;
  /** Hits/total for the record that drove `ratio` (aggregated in pooled mode). */
  hits: number;
  totalPeriods: number;
  /**
   * The current user's OWN hits and period count. Identical to hits/totalPeriods
   * in isolated mode, but distinct in pooled mode where those are group-wide —
   * the perfect-run bonus is personal, so it needs the personal numbers.
   */
  myHits: number;
  myTotalPeriods: number;
}

/** Payout multiplier for a 0–1 completion ratio. Full completion escapes the 80% band. */
export function challengeRewardMultiplier(ratio: number): number {
  if (ratio >= 1) return 1;
  return Math.max(0, ratio) * CHALLENGE_PARTIAL_BAND;
}

/**
 * Completion ratio driving the payout, per the challenge's reward mode.
 *
 * Pooled sums every accepted participant's hits over the group's total possible
 * hits, which reaches 1 only when everyone completed everything — that is
 * exactly the all-or-nothing binding, expressed as one number.
 */
export function challengeCompletionRatio(
  challenge: ChallengeItem,
  currentUserId: string
): { ratio: number; hits: number; totalPeriods: number } {
  const totalPeriods = challenge.totalPeriods;
  if (totalPeriods <= 0) return { ratio: 0, hits: 0, totalPeriods: 0 };

  if (challenge.rewardMode === 'pooled') {
    const accepted = challenge.participants.filter((p) => p.status === 'accepted');
    if (accepted.length === 0) return { ratio: 0, hits: 0, totalPeriods };
    // Cap each participant at their own total: a client that over-reported hits
    // must not let one person carry the group past 100%.
    const hits = accepted.reduce((sum, p) => sum + Math.min(p.hits, totalPeriods), 0);
    const possible = totalPeriods * accepted.length;
    return { ratio: hits / possible, hits, totalPeriods: possible };
  }

  const hits = challengeMyHits(challenge, currentUserId);
  return { ratio: hits / totalPeriods, hits, totalPeriods };
}

/** The current user's own hits, capped at the challenge's period count. */
export function challengeMyHits(challenge: ChallengeItem, currentUserId: string): number {
  const me =
    challenge.myParticipant ??
    challenge.participants.find((p) => p.userId === currentUserId) ??
    null;
  return Math.min(me?.hits ?? 0, challenge.totalPeriods);
}

/**
 * Total fruits earned with the challenge tag inside the challenge window.
 *
 * Mirrors the session matching `updateMyHitsLocally` uses — primary or secondary
 * tag, session start time inside the date range — so the fruits being doubled are
 * exactly the ones from the sessions that drove the hits. A dual-tag session
 * counts its full fruits (they are not split per tag anywhere in the app).
 */
export function computeChallengeTagFruits(
  sessions: any[],
  tagId: string,
  startDate: string,
  endDate: string
): number {
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T23:59:59.999').getTime();

  return sessions.reduce((sum, s) => {
    if (!s || s.deletedAt) return sum;
    const t = new Date(s.startTime).getTime();
    if (t < start || t > end) return sum;
    if (s.tagId !== tagId && s.secondaryTagId !== tagId) return sum;
    return sum + sessionFruits(s);
  }, 0);
}

/**
 * Full reward breakdown for a challenge, from the current user's local sessions.
 * `sessions` is the flat list of the user's own focus sessions.
 */
export function computeChallengeReward(
  challenge: ChallengeItem,
  sessions: any[],
  currentUserId: string
): ChallengeRewardBreakdown {
  const { ratio, hits, totalPeriods } = challengeCompletionRatio(challenge, currentUserId);
  const multiplier = challengeRewardMultiplier(ratio);
  const baseFruits =
    challenge.startDate && challenge.endDate
      ? computeChallengeTagFruits(sessions, challenge.tagId, challenge.startDate, challenge.endDate)
      : 0;

  // Pooled only: your own perfect run pays +10% of your own fruits regardless of
  // what the group managed. Rounded separately from the multiplied base so the
  // two lines the UI shows add up to the total exactly.
  const isPooled = challenge.rewardMode === 'pooled';
  const myTotalPeriods = challenge.totalPeriods;
  const myHits = challengeMyHits(challenge, currentUserId);
  const earnedPerfectBonus = isPooled && myTotalPeriods > 0 && myHits >= myTotalPeriods;
  const potentialPerfectBonus = isPooled ? Math.round(baseFruits * CHALLENGE_PERFECT_BONUS) : 0;
  const perfectBonus = earnedPerfectBonus ? potentialPerfectBonus : 0;

  return {
    baseFruits,
    ratio,
    multiplier,
    reward: Math.round(baseFruits * multiplier) + perfectBonus,
    perfectBonus,
    potentialPerfectBonus,
    earnedPerfectBonus,
    isFull: ratio >= 1,
    hits,
    totalPeriods,
    myHits,
    myTotalPeriods,
  };
}
