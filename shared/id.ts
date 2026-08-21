/**
 * Compact time-ordered id: base36 ms timestamp + 10 random base36 chars.
 *
 * The timestamp prefix keeps ids lexicographically chronological (right-edge
 * B-tree inserts in Postgres); 10 random chars (~3.6e15) rules out cross-user
 * collisions within a millisecond at any realistic scale.
 *
 * Lives in `shared/` because both clients now mint session ids: iOS via
 * `createCompletedSession`, desktop when it starts a live session (the id is
 * chosen up front and carried on `active_sessions.session_id`, so both devices
 * finish the same row). The Swift widget stop path (`SessionIntent.swift`
 * generateCompactId) mirrors this format — keep that one in sync by hand.
 */
export const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  let randomStr = '';
  for (let i = 0; i < 10; i++) {
    randomStr += Math.floor(Math.random() * 36).toString(36);
  }
  return `${timestamp}-${randomStr}`;
};
