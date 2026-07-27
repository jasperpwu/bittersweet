/**
 * Catalog of purchasable usage tips (fruit store "Product Usage Tip").
 *
 * Each id maps to a localized message at `store.tips.<id>` in the locale files.
 * Purchases are recorded with their tipId (locally + `purchases` table in
 * Supabase), so pickTipId can serve a tip the user hasn't bought yet.
 *
 * ⚠️ Tip ids are a persistence contract: they are stored forever in
 * `purchases.tip_id` and in users' local purchase history. NEVER rename or
 * reuse an existing id — only append new ones. To reword a tip, edit its
 * `store.tips.<id>` locale strings and keep the id. To retire a tip, remove it
 * here (it stops being sold); history rows with a retired id fall back to a
 * generic "Usage Tip" label in the UI.
 */
export const TIP_IDS = [
  'infinite_session',
  'sweet_spot',
  'accelerate_timing',
  'focus_rating',
  'goal_badge',
  'widget_setup',
  'recurring_todos',
  'unlock_cost',
  'swipe_to_start',
  'multi_task_mode',
  'apple_health',
  'inner_circle',
  'goal_reminders',
  'rating_activity_type',
  'contact_support',
] as const;

export type TipId = (typeof TIP_IDS)[number];

/** Whether there is still a tip the user hasn't purchased (i.e. tips are sellable). */
export function hasUnpurchasedTips(purchasedTipIds: string[]): boolean {
  return TIP_IDS.some((id) => !purchasedTipIds.includes(id));
}

/**
 * Pick the tip to sell next: random among tips the user hasn't purchased yet.
 * Returns null once the whole catalog is owned — tips are never re-sold; the
 * store shows a "come back later" state instead (new catalog entries make the
 * product purchasable again).
 */
export function pickTipId(purchasedTipIds: string[]): TipId | null {
  const unseen = TIP_IDS.filter((id) => !purchasedTipIds.includes(id));
  if (unseen.length === 0) return null;
  return unseen[Math.floor(Math.random() * unseen.length)];
}

/**
 * Where a tip's "Try it" button sends the user — the screen where the tip can
 * actually be practised. Routes match the deep-link targets in `app/_layout.tsx`
 * (REENGAGE_ROUTES) and are opened with `router.navigate`, so a tab route pops
 * back to the already-mounted tab instead of stacking a second one.
 *
 * Only tips with somewhere to go get an entry. Deliberately omitted:
 * `sweet_spot`/`focus_rating`/`unlock_cost` (knowledge, nothing to open),
 * `accelerate_timing` (the store the user is already standing in), and
 * `widget_setup` (the Home Screen widget gallery isn't reachable from an app).
 */
export const TIP_ROUTES: Partial<Record<TipId, string>> = {
  infinite_session: '/(tabs)',
  goal_badge: '/(tabs)/insights',
  recurring_todos: '/(tabs)/journal',
  swipe_to_start: '/(tabs)/journal',
  multi_task_mode: '/settings/preferences',
  goal_reminders: '/settings/preferences',
  apple_health: '/settings/health',
  // Grove settings, not the Inner Circle modal itself: it holds the Inner Circle
  // row *and* handles the no-Grove-profile case with a setup CTA, where the
  // modal would dead-end for a user who hasn't set up Grove yet.
  inner_circle: '/settings/grove-settings',
  // Tag activity types are edited from the focus tab's tag list (CreateTagModal
  // / EditTagSheet).
  rating_activity_type: '/(tabs)',
  contact_support: '/settings/support',
};
