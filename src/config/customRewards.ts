/**
 * Custom rewards (fruit store "Custom" tab) — product-id helpers.
 *
 * Custom rewards are user-defined catalog items (name + cost + optional emoji)
 * stored in the rewards slice (`customRewards`) and synced to the
 * `custom_rewards` table. Buying one records a `purchases` row whose
 * product_id is `custom_<rewardId>` — ownership derives from purchase history,
 * same contract as slider themes (`theme_<id>`, see sliderThemes.ts).
 *
 * ⚠️ product_id values are a persistence contract: `custom_<id>` rows live
 * forever in `purchases`. History rows whose reward definition was deleted
 * fall back to a generic label in the UI.
 */

export const CUSTOM_REWARD_PRODUCT_PREFIX = 'custom_';

/** Emoji shown for a custom reward that was created without one. */
export const DEFAULT_CUSTOM_REWARD_EMOJI = '🎁';

export function customRewardProductId(rewardId: string): `custom_${string}` {
  return `${CUSTOM_REWARD_PRODUCT_PREFIX}${rewardId}`;
}

/** Extract the custom reward id from a purchase's product_id, or null if it
 *  isn't a custom-reward purchase. */
export function customRewardIdFromProductId(productId: string): string | null {
  return productId.startsWith(CUSTOM_REWARD_PRODUCT_PREFIX)
    ? productId.slice(CUSTOM_REWARD_PRODUCT_PREFIX.length)
    : null;
}
