import { TextStyle } from 'react-native';
import { SESSION_NOTES } from '../config/constants';

/**
 * Clamp a session note to the hard cap. The inputs already set `maxLength`, so this
 * is the backstop for notes that never went through them — rows written by older
 * builds, or anything imported. It matters because the cap is NOT a DB constraint:
 * an over-length row must never be able to fail its upsert, since a rejected row
 * stays in the sync queue and takes its session with it.
 */
export const clampSessionNotes = (notes?: string | null): string | undefined => {
  if (!notes) return undefined;
  return notes.length > SESSION_NOTES.maxLength
    ? notes.slice(0, SESSION_NOTES.maxLength)
    : notes;
};

/**
 * Split a note into the feed preview and whether anything was withheld. Character-
 * based (like Instagram) rather than line-based on purpose: the feed cards are
 * different widths, and a line-count rule would expand/collapse inconsistently
 * between them for the same note.
 */
export const previewSessionNotes = (
  notes: string
): { preview: string; isTruncated: boolean } => {
  if (notes.length <= SESSION_NOTES.previewLength) {
    return { preview: notes, isTruncated: false };
  }
  return {
    // Trim so the ellipsis never follows a dangling space.
    preview: notes.slice(0, SESSION_NOTES.previewLength).trimEnd(),
    isTruncated: true,
  };
};

/**
 * Creates text styles that prevent clipping on both iOS and Android
 */
export const createNoClipTextStyle = (baseStyle: TextStyle): TextStyle => ({
  ...baseStyle,
  // Android specific properties to prevent clipping
  includeFontPadding: false,
  textAlignVertical: 'center',
  // Ensure proper line height
  lineHeight: baseStyle.lineHeight || (baseStyle.fontSize ? baseStyle.fontSize * 1.3 : undefined),
});

/**
 * Gets the minimum line height for a given font size to prevent clipping
 */
export const getMinLineHeight = (fontSize: number): number => {
  return Math.ceil(fontSize * 1.3);
};

/**
 * Validates if a line height is sufficient for the given font size
 */
export const isLineHeightSufficient = (fontSize: number, lineHeight: number): boolean => {
  return lineHeight >= fontSize * 1.2;
};