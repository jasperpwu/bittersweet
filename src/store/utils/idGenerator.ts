/**
 * ID generation utility for entities
 */

/**
 * Generate a unique ID using timestamp and random string.
 * Format: base36 ms timestamp + "-" + 10 random base36 chars — time-ordered
 * and compact. Must stay in sync with generateId in store/index.ts and
 * generateCompactId in SessionIntent.swift.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  let randomStr = '';
  for (let i = 0; i < 10; i++) {
    randomStr += Math.floor(Math.random() * 36).toString(36);
  }
  return `${timestamp}-${randomStr}`;
}

/**
 * Generate a UUID v4 (more robust but heavier)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a short ID for display purposes
 */
export function generateShortId(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}