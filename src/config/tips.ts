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
