import { useAppStore } from '../store';

const FREE_LIMITS = {
  maxTags: 3,
  maxGoals: 1,
} as const;

export function useSubscriptionGate() {
  const tier = useAppStore((state) => state.subscription.tier);
  const tagCount = useAppStore((state) => state.focus.tags.allIds.length);
  const goalCount = useAppStore((state) => state.focus.goals.allIds.length);

  const isPremium = tier === 'premium';

  return {
    isPremium,
    canCreateTag: isPremium || tagCount < FREE_LIMITS.maxTags,
    canCreateGoal: isPremium || goalCount < FREE_LIMITS.maxGoals,
    tagCount,
    goalCount,
    maxTags: isPremium ? Infinity : FREE_LIMITS.maxTags,
    maxGoals: isPremium ? Infinity : FREE_LIMITS.maxGoals,
  };
}
