import * as Linking from 'expo-linking';
import { SHARE_LINK_BASE } from '../config/constants';

/**
 * The two deep-link flows a shared code can open. They carry the SAME code —
 * `referralSlice.generateReferralCode` reuses `GroveFriendService.generateInviteLink()`
 * — and differ only in what the handler does with it (see useDeepLinkHandler):
 *
 *  - `refer`  → records referral attribution toward the reward tiers. Only does
 *               anything for a brand-new user; parked in AsyncStorage until sign-up.
 *  - `invite` → opens the Grove friend-request preview. Requires the recipient
 *               to already be signed in with a Grove profile.
 */
export type ShareLinkType = 'refer' | 'invite';

/**
 * True when running a dev-variant build, whose scheme is `bittersweet-mobile-dev`.
 * Derived from the scheme the app actually claims rather than a manifest field,
 * so it can't drift from what `app.config.js` produced.
 */
function isDevBuild(): boolean {
  return Linking.createURL('').startsWith('bittersweet-mobile-dev:');
}

/**
 * Builds the URL to hand to the share sheet.
 *
 * Production shares an https:// page rather than the raw `bittersweet-mobile://`
 * deep link, for two reasons a custom scheme can't solve:
 *   1. iMessage/WhatsApp/Instagram don't linkify unknown schemes — the link
 *      arrives as unpressable grey text.
 *   2. On a phone without the app, a custom scheme resolves to nothing. There is
 *      no App Store fallback, and iOS has no install-referrer API to recover the
 *      code afterwards.
 * The page (public_docs/r.html) attempts the deep link, then falls back to the
 * App Store and shows the code for manual entry.
 *
 * Dev builds share the raw deep link instead: the page only knows the production
 * scheme, so routing a dev link through it would open the wrong app (or none).
 */
export function buildShareLink(type: ShareLinkType, code: string): string {
  if (isDevBuild()) {
    return Linking.createURL(`${type}/${code}`);
  }
  return `${SHARE_LINK_BASE}?c=${encodeURIComponent(code)}&t=${type}`;
}
