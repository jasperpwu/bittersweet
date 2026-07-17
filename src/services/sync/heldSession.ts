/**
 * Transient marker for the session completed right before the post-session
 * sign-in sheet. If that sign-in lands on an EXISTING account, the auth handler
 * wipes all local data before mirroring the cloud — this marker tells it to push
 * the marked session to the cloud first so it survives the wipe (see
 * sync.pushHeldSessionToCloud).
 *
 * Deliberately in-memory only: it must never outlive the app launch or leak into
 * an unrelated auth transition. Every genuine SIGNED_IN consumes it via take(),
 * and dismissing the sign-in sheet clears it.
 */
let heldSessionId: string | null = null;

export const setHeldSessionId = (id: string): void => {
  heldSessionId = id;
};

export const clearHeldSessionId = (): void => {
  heldSessionId = null;
};

/** Read and clear in one step — the marker is single-use. */
export const takeHeldSessionId = (): string | null => {
  const id = heldSessionId;
  heldSessionId = null;
  return id;
};
