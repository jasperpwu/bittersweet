// Tag color palette, grouped into named families so users can either keep a
// unified style (all Pastel, all Earth, …) or mix across families.
//
// These are data values (persisted on each tag's `color` field), not theme
// tokens — a tag's color must render identically in light and dark mode, so it
// is intentionally a fixed hex rather than a NativeWind token.
//
// Backward compatibility: the eight original colors live in the "Classic"
// family, so every existing tag's stored color still appears as a selectable
// swatch.

export interface TagColorFamily {
  /** Display label shown above the family's swatch row. */
  name: string;
  /** Hex colors (uppercase, `#RRGGBB`) belonging to this family. */
  colors: string[];
}

/**
 * The original eight tag colors, keyed by hue. This is the source of truth for
 * both the "Classic" family swatches and the onboarding suggested-tag colors,
 * so the two never drift apart.
 */
export const CLASSIC_TAG_COLORS = {
  blue: '#6592E9',
  green: '#51BC6F',
  amber: '#FFC107',
  orange: '#FF9800',
  red: '#FD5B71',
  purple: '#9C27B0',
  skyBlue: '#2196F3',
  gray: '#9E9E9E',
} as const;

export const TAG_COLOR_FAMILIES: TagColorFamily[] = [
  {
    name: 'Classic',
    colors: Object.values(CLASSIC_TAG_COLORS),
  },
  {
    name: 'Pastel',
    colors: [
      '#A8D8EA',
      '#AA96DA',
      '#FCBAD3',
      '#FFDAC1',
      '#C5E1A5',
      '#B5EAD7',
      '#FFF1A6',
      '#D6A2E8',
    ],
  },
  {
    name: 'Earth',
    colors: [
      '#A0522D',
      '#C17767',
      '#8D6E63',
      '#B07D4F',
      '#6B8E23',
      '#7D8471',
      '#C19A6B',
      '#5C4033',
    ],
  },
  {
    name: 'Neutral',
    colors: [
      '#2C3E50',
      '#5D6D7E',
      '#85929E',
      '#9E9E9E',
      '#BDBDBD',
      '#6B7280',
      '#34495E',
      '#4A4A4A',
    ],
  },
  {
    name: 'Neon',
    colors: [
      '#FF0080',
      '#00E5FF',
      '#B0FF00',
      '#FFE600',
      '#FF3D00',
      '#D500F9',
      '#00FFB3',
      '#FF6D00',
    ],
  },
];

/** Flat list of every selectable tag color, in family order. */
export const TAG_COLORS: string[] = TAG_COLOR_FAMILIES.flatMap((family) => family.colors);

/** Default color applied to a new tag when the user hasn't picked one. */
export const DEFAULT_TAG_COLOR: string = CLASSIC_TAG_COLORS.blue;

/**
 * Suggested color for a new tag: the first palette color (family order, so
 * Classic first) not already used by an existing tag. Keeps tags created
 * without ever opening the color picker visually distinct from each other.
 * Falls back to the default blue when every palette color is taken.
 */
export function nextUnusedTagColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()));
  return TAG_COLORS.find((c) => !used.has(c.toUpperCase())) ?? DEFAULT_TAG_COLOR;
}

/**
 * Returns true when `hex` is light enough that a white selection ring/checkmark
 * would be low-contrast against it — used to flip the selection indicator to a
 * dark color over pale swatches (e.g. Pastel, light Neutral).
 */
export function isLightColor(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.601). > 0.6 reads as "light".
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}
