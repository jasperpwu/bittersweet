import { useAppStore } from '../store';

const FREE_LIMITS = {
  maxTags: 3,
  maxActiveGoals: 1,
} as const;

export function useSubscriptionGate() {
  const tier = useAppStore((state) => state.subscription.tier);
  const tagCount = useAppStore((state) => 
    state.focus.tags.allIds.filter(id => !state.focus.tags.byId[id]?.deletedAt).length
  );
  const activeGoalCount = useAppStore((state) =>
    state.focus.goals.allIds.filter(id => state.focus.goals.byId[id]?.isActive).length
  );

  const isPremium = tier === 'premium';

  return {
    isPremium,
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
