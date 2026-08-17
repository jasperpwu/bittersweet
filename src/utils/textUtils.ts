import { TextStyle } from 'react-native';

// The note helpers moved to `shared/` — `sessionToRow` clamps on every write and
// runs in the desktop client too, which cannot import anything that touches
// react-native (this file does, on the line above). Re-exported so the existing
// import sites keep working.
export { clampSessionNotes, previewSessionNotes } from '../../shared/sessionNotes';

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
