/**
 * Internal dev/test accounts (Supabase auth user ids). Single source for
 * dev-only affordances: the journal tab's sync-state banner and the 1-apple
 * slider-theme test price. Keep this list tiny and never gate real features
 * on it.
 */
export const DEV_USER_IDS = [
  '9c931ba0-39e9-4597-b691-4b941b0c7118',
  'b022d7ab-fd25-4bbc-9ebc-1df65e87248a',
] as const;

export function isDevUser(userId: string | null | undefined): boolean {
  return !!userId && (DEV_USER_IDS as readonly string[]).includes(userId);
}
