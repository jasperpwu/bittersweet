import { useAppStore } from '../store';

const FREE_LIMITS = {
  maxActiveGoals: 1,
  // Free users get 3 tags (the onboarding starter set); the 4th requires Premium.
  maxTags: 3,
} as const;

export function useSubscriptionGate() {
  const tier = useAppStore((state) => state.subscription.tier);
  const tagCount = useAppStore(
    (state) => state.focus.tags.allIds.filter((id) => !state.focus.tags.byId[id]?.deletedAt).length
  );
  const activeGoalCount = useAppStore(
    (state) => state.focus.goals.allIds.filter((id) => state.focus.goals.byId[id]?.isActive).length
  );

  const isPremium = tier === 'premium';

  return {
    isPremium,
    // Free tier is capped at 3 tags; Premium is unlimited.
    canCreateTag: isPremium || tagCount < FREE_LIMITS.maxTags,
    canActivateGoal: isPremium || activeGoalCount < FREE_LIMITS.maxActiveGoals,
    // Keep canCreateGoal for backward compat (alias for canActivateGoal)
    canCreateGoal: isPremium || activeGoalCount < FREE_LIMITS.maxActiveGoals,
    tagCount,
    activeGoalCount,
    maxTags: isPremium ? Infinity : FREE_LIMITS.maxTags,
    maxActiveGoals: isPremium ? Infinity : FREE_LIMITS.maxActiveGoals,
  };
}
