import { Ionicons } from '@expo/vector-icons';

export interface PremiumPerk {
  icon: keyof typeof Ionicons.glyphMap;
  /** i18n key (full path) — resolved with `t(labelKey)` at render time. */
  labelKey: string;
}

/**
 * The canonical list of Premium perks, shown in both the paywall sheet
 * (`UpgradeSheet`) and the contextual upgrade prompt (`UpgradePrompt`).
 * Keep this as the single source of truth so the two surfaces never drift —
 * add a perk here and both surfaces pick it up automatically.
 */
export const PREMIUM_PERKS: PremiumPerk[] = [
  { icon: 'flag-outline', labelKey: 'subscription.perkUnlimitedGoals' },
  { icon: 'pricetags-outline', labelKey: 'subscription.perkUnlimitedTags' },
  { icon: 'heart-outline', labelKey: 'subscription.perkHealthSync' },
  { icon: 'sparkles-outline', labelKey: 'subscription.perkMultiTask' },
  { icon: 'cloud-outline', labelKey: 'subscription.perkCloudSync' },
];
