import { useMemo } from 'react';
import { useAppStore } from '../store';
import { computeChallengeReward, type ChallengeRewardBreakdown } from '../utils/challengeReward';
import type { ChallengeItem } from '../services/grove/GroveChallengeService';

/**
 * Live reward breakdown for a challenge, from the current user's local sessions.
 *
 * While the challenge is running this is a running projection ("what you'd claim
 * if it ended now"); once it is over it is the claimable amount. Subscribes to
 * the whole `focus.sessions` slice (a stable reference) rather than deriving a
 * fresh object in the selector, so it only re-renders when sessions change.
 */
export function useChallengeReward(
  challenge: ChallengeItem | null
): ChallengeRewardBreakdown | null {
  const sessionState = useAppStore((s) => s.focus.sessions);
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');

  return useMemo(() => {
    if (!challenge) return null;
    const sessions = sessionState.allIds.map((id: string) => sessionState.byId[id]).filter(Boolean);
    return computeChallengeReward(challenge, sessions, currentUserId);
  }, [challenge, sessionState, currentUserId]);
}
