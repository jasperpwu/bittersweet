import { useSubscriptionGate } from './useSubscriptionGate';
import { useAppSettings } from '../store/unified-store';

/**
 * Whether the optional secondary tag picker should be available.
 *
 * Gated on BOTH the premium "ADHD mode" preference being on AND an active
 * premium subscription — so a lapsed subscription disables the feature even if
 * the stored flag is still true. Use this to show/hide the secondary tag picker
 * across the session summary, manual-create, and edit modals.
 */
export function useSecondaryTagEnabled(): boolean {
  const { isPremium } = useSubscriptionGate();
  const { preferences } = useAppSettings();
  return isPremium && !!preferences.adhdModeEnabled;
}
