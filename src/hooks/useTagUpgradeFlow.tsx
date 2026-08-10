import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UpgradePrompt } from '../components/subscription/UpgradePrompt';
import { UpgradeSheet } from '../components/subscription/UpgradeSheet';
import { SignInSheet } from '../components/auth/SignInSheet';
import { useAppStore } from '../store';
import { AnalyticsTracker } from '../services/analytics';

/** A feature gate the free tier blocks — decides the prompt copy AND the paywall source. */
type LimitType = 'tags' | 'goals' | 'adhd' | 'health';

/**
 * Where a paywall impression came from. A superset of LimitType: `settings` is
 * the voluntary "Upgrade" button, which has no gate and never shows the prompt.
 * Without it those opens reported `source: 'tags'` (the old default argument),
 * inflating tags' share of tile 16 with people who were never gated at all.
 */
type PaywallSource = LimitType | 'settings';

/**
 * Shared paywall flow, sequenced one sheet at a time:
 *
 *   [UpgradePrompt "paid feature"] → [UpgradeSheet] ⇄ [SignInSheet, optional]
 *
 *   const { triggerUpgrade, upgradeModals } = useUpgradeFlow('goals');
 *   ...call triggerUpgrade() at the gate; render {upgradeModals}.
 *   // voluntary "Upgrade" buttons skip the prompt: onPress={openPlans}
 *
 * Why sequenced (not stacked): each sheet is a native RN Modal, and iOS fails to
 * present a modal while another is on screen or animating out (invisible,
 * touch-blocking overlay). So every hand-off waits for the current sheet's
 * `onClosed` before opening the next — never more than one paywall modal at once.
 *
 * Sign-in is NEVER required to buy. App Review guideline 5.1.1 forbids gating an
 * In-App Purchase behind registration when the purchased features aren't
 * account-specific (ours are local: tags, goals, Health import, Multi-Task).
 * Premium therefore lives on the device's StoreKit entitlement, and signing in
 * is offered from inside the paywall purely as a way to carry it to other
 * devices — `subscriptionSlice.syncEntitlementToServer()` attaches an already-
 * bought subscription to the account whenever the user does sign in later.
 *
 * When the trigger lives inside a BottomSheet, render `upgradeModals` in that
 * sheet's `overlay` slot (not screen root) so iOS presents it on top, and have
 * that host fire the trigger from its own `onClosed` if it dismisses itself.
 */
export function useUpgradeFlow(source: PaywallSource = 'tags') {
  const { t } = useTranslation();
  // The prompt only ever appears behind a real gate (triggerUpgrade), which the
  // voluntary 'settings' entry never calls — so its copy fallback is unreachable.
  const limitType: LimitType = source === 'settings' ? 'tags' : source;
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  // What to open once the currently-closing sheet is fully gone.
  const next = useRef<null | 'signin' | 'sheet'>(null);

  // Open the subscription sheet. Used both as the prompt's follow-on and
  // directly by voluntary "Upgrade" buttons. No auth check — see header.
  const openPlans = () => setShowSheet(true);

  const upgradeModals = (
    <>
      <UpgradePrompt
        isVisible={showPrompt}
        onClose={() => setShowPrompt(false)}
        // Record intent now; act once the prompt has fully dismissed.
        onUpgrade={() => {
          next.current = 'sheet';
        }}
        onClosed={() => {
          if (next.current === 'sheet') {
            next.current = null;
            setShowSheet(true);
          }
        }}
        limitType={limitType}
      />

      <SignInSheet
        visible={showSignIn}
        subtitle={t('subscription.signInToSync')}
        onClose={() => setShowSignIn(false)}
        // Sheet closes itself on success, then we reopen the plans on full
        // dismiss so the user lands back where they left off.
        onSignedIn={() => {
          next.current = 'sheet';
        }}
        onClosed={() => {
          if (next.current === 'sheet') {
            next.current = null;
            setShowSheet(true);
          }
        }}
      />

      <UpgradeSheet
        isVisible={showSheet}
        onClose={() => setShowSheet(false)}
        // Optional "use Premium on your other devices" link inside the paywall:
        // close the plans first, then present sign-in (one modal at a time).
        onRequestSignIn={() => {
          next.current = 'signin';
          setShowSheet(false);
        }}
        onClosed={() => {
          if (next.current === 'signin') {
            next.current = null;
            setShowSignIn(true);
          }
        }}
        // The gate that triggered this flow is exactly the paywall's `source`.
        source={source}
      />
    </>
  );

  return {
    /** Gated features: open the "paid feature" prompt first. */
    triggerUpgrade: () => {
      // Analytics: the top of the monetization funnel — someone was actually
      // stopped by the free tier. Distinct from `paywall_viewed`, which only
      // fires a sheet later on the plans screen: between the two sits the
      // "paid feature" prompt, so counting plan views alone silently drops
      // everyone who bounced at the wall. Full funnel: paywall_gate_hit →
      // paywall_viewed → subscription_started. `source` is named to match
      // `paywall_viewed`'s property so one breakdown reads across every step.
      AnalyticsTracker.track('paywall_gate_hit', {
        source: limitType,
        // Signed-out users can now buy directly; kept as a cohort split to see
        // whether having an account still correlates with converting.
        signed_in: useAppStore.getState().auth.isAuthenticated,
      });
      setShowPrompt(true);
    },
    /** Voluntary upgrade buttons: skip the prompt, sign-in-gate → plans. */
    openPlans,
    upgradeModals,
  };
}

/** Tag-limit convenience wrapper — the most common caller. */
export const useTagUpgradeFlow = () => useUpgradeFlow('tags');
