import * as WebBrowser from 'expo-web-browser';

// Hosted UserJot feedback board. Create a project at https://userjot.com and
// replace this with your board URL (Settings → Board → public URL), e.g.
// https://bittersweet.userjot.com.
//
// The board supports anonymous posting out of the box; users can optionally
// sign in on the board itself (email/Google) to attach their identity. We do
// not pass identity from the app — no server-side token signing required.
const USERJOT_BOARD_URL = 'https://bittersweet.userjot.com';

/**
 * Opens the feedback board in an in-app browser (SFSafariViewController on iOS),
 * keeping the user inside the app rather than handing off to external Safari.
 */
export function openFeedbackBoard() {
  return WebBrowser.openBrowserAsync(USERJOT_BOARD_URL);
}
