import { Ionicons } from '@expo/vector-icons';

export interface PremiumPerk {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

/**
 * The canonical list of Premium perks, shown in both the upgrade sheet
 * (`UpgradeSheet`) and the contextual upgrade prompt (`UpgradePrompt`).
 * Keep this as the single source of truth so the two surfaces never drift.
 */
export const PREMIUM_PERKS: PremiumPerk[] = [
  { icon: 'flag-outline', label: 'Unlimited goals' },
  { icon: 'pricetags-outline', label: 'Unlimited tags' },
  { icon: 'heart-outline', label: 'Apple Health workout syncing' },
  { icon: 'sparkles-outline', label: 'Multi-Task mode (dual-tag sessions)' },
  { icon: 'cloud-outline', label: 'Cloud backup & sync' },
];
