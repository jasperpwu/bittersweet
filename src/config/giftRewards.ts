/**
 * Gift rewards (fruit store "Custom" tab, Grove social) — product-id helpers.
 *
 * A gift reward is created by one Grove user FOR a friend and lives in the
 * cross-user `gift_rewards` table (grove-style, fetched via GiftRewardService —
 * NOT the per-user sync pipeline). When the recipient buys it, their fruit
 * debit records a normal `purchases` row whose product_id is `gift_<giftId>`,
 * so the recipient's history syncs like any other purchase. The sender has no
 * purchase row; their history entry is synthesized from the gift row itself.
 *
 * ⚠️ product_id values are a persistence contract: `gift_<id>` rows live
 * forever in `purchases`. History rows resolve name/emoji/photo from the
 * fetched gift rows, with a generic fallback while gifts haven't loaded.
 */

export const GIFT_PRODUCT_PREFIX = 'gift_';

/** Emoji shown for a gift reward that was created without one. */
export const DEFAULT_GIFT_EMOJI = '🎀';

export function giftProductId(giftId: string): `gift_${string}` {
  return `${GIFT_PRODUCT_PREFIX}${giftId}`;
}

/** Extract the gift id from a purchase's product_id, or null if it isn't a
 *  gift purchase. */
export function giftIdFromProductId(productId: string): string | null {
  return productId.startsWith(GIFT_PRODUCT_PREFIX)
    ? productId.slice(GIFT_PRODUCT_PREFIX.length)
    : null;
}
