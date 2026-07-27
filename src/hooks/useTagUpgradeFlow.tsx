import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UpgradePrompt } from '../components/subscription/UpgradePrompt';
import { UpgradeSheet } from '../components/subscription/UpgradeSheet';
import { SignInSheet } from '../components/auth/SignInSheet';
import { useAppStore } from '../store';

type LimitType = 'tags' | 'goals' | 'adhd' | 'health';

/**
 * Shared paywall flow, sequenced one sheet at a time:
 *
 *   [UpgradePrompt "paid feature"] → [SignInSheet if signed out] → [UpgradeSheet]
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
 * Sign-in is gated BEFORE the subscription sheet because a purchase made while
 * signed out is charged by Apple but never recorded (entitlement lives on the
 * cloud profile row keyed by user id).
 *
 * When the trigger lives inside a BottomSheet, render `upgradeModals` in that
 * sheet's `overlay` slot (not screen root) so iOS presents it on top, and have
 * that host fire the trigger from its own `onClosed` if it dismisses itself.
 */
export function useUpgradeFlow(limitType: LimitType = 'tags') {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  // What to open once the currently-closing sheet is fully gone.
  const next = useRef<null | 'signin' | 'sheet'>(null);

  // Open the subscription sheet, gating sign-in first when needed. Used both as
  // the prompt's follow-on and directly by voluntary "Upgrade" buttons.
  const openPlans = () => {
    if (useAppStore.getState().auth.isAuthenticated) setShowSheet(true);
    else setShowSignIn(true);
  };

  const upgradeModals = (
    <>
      <UpgradePrompt
        isVisible={showPrompt}
        onClose={() => setShowPrompt(false)}
        // Record intent now; act once the prompt has fully dismissed.
        onUpgrade={() => {
          next.current = useAppStore.getState().auth.isAuthenticated ? 'sheet' : 'signin';
        }}
        onClosed={() => {
          const step = next.current;
          next.current = null;
          if (step === 'sheet') setShowSheet(true);
          else if (step === 'signin') setShowSignIn(true);
        }}
        limitType={limitType}
      />

      <SignInSheet
        visible={showSignIn}
        subtitle={t('subscription.signInToSubscribe')}
        onClose={() => setShowSignIn(false)}
        // Sheet closes itself on success, then we open the plans on full dismiss.
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
        // The gate that triggered this flow is exactly the paywall's `source`.
        source={limitType}
      />
    </>
  );

  return {
    /** Gated features: open the "paid feature" prompt first. */
    triggerUpgrade: () => setShowPrompt(true),
    /** Voluntary upgrade buttons: skip the prompt, sign-in-gate → plans. */
    openPlans,
    upgradeModals,
  };
}

/** Tag-limit convenience wrapper — the most common caller. */
export const useTagUpgradeFlow = () => useUpgradeFlow('tags');
