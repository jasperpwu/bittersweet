/**
 * Catalog of purchasable slider themes (fruit store "Themes" tab).
 *
 * A slider theme re-skins every Slider in the app: the active track wears the
 * theme's stripe colors and the thumb becomes the theme's emoji (soccer ball
 * for the country collection). Ownership is derived from purchase history
 * (`purchases` rows with product_id `theme_<id>`), and the applied theme lives
 * in unified-store preferences (`sliderThemeId`, device-local).
 *
 * ⚠️ Theme ids are a persistence contract (same rules as tip ids): they are
 * stored forever inside `purchases.product_id` as `theme_<id>`. NEVER rename
 * or reuse an existing id — only append new ones. Retiring a theme (removing
 * it here) stops it being sold; history rows with a retired id fall back to a
 * generic label in the UI.
 *
 * Colors below are theme DATA (flag stripe colors), intentionally kept here as
 * the single shared source — never inline them elsewhere.
 */
import { isDevUser } from './devUsers';

export const SLIDER_THEME_COST = 50;

/** Theme price in apples for a given account — internal dev accounts pay 1
 *  so purchases are easy to test. */
export function sliderThemeCostForUser(userId: string | null | undefined): number {
  return isDevUser(userId) ? 1 : SLIDER_THEME_COST;
}

export const THEME_PRODUCT_PREFIX = 'theme_';

/** Default (classic) slider colors — the un-themed look. Single source for
 *  Slider.tsx and the store's "Classic" preview. */
export const DEFAULT_SLIDER_COLORS = {
  activeTrack: '#6592E9',
  thumb: '#FFFFFF',
} as const;

export interface SliderTheme {
  /** Persistence contract — see header comment. Country name lives at `store.themes.<id>`. */
  id: string;
  /** Flag emoji shown on the store card and in purchase history. */
  flag: string;
  /** Active-track stripe colors, rendered left-to-right at equal widths. */
  trackColors: string[];
  /** Emoji rendered as the slider thumb. */
  thumbEmoji: string;
}

// First collection: all 48 nations of the 2026 World Cup. Track = flag colors,
// thumb = ⚽. The store sorts these alphabetically by localized name at render
// time (see the Themes tab A-Z index), so array order here is not significant —
// but ids are a persistence contract (see header): only ever append.
export const SLIDER_THEMES: SliderTheme[] = [
  { id: 'canada', flag: '🇨🇦', trackColors: ['#D80621', '#FFFFFF', '#D80621'], thumbEmoji: '⚽' },
  {
    id: 'south_africa',
    flag: '🇿🇦',
    trackColors: ['#007749', '#FFB612', '#DE3831'],
    thumbEmoji: '⚽',
  },
  { id: 'brazil', flag: '🇧🇷', trackColors: ['#009C3B', '#FFDF00', '#002776'], thumbEmoji: '⚽' },
  { id: 'japan', flag: '🇯🇵', trackColors: ['#FFFFFF', '#BC002D', '#FFFFFF'], thumbEmoji: '⚽' },
  { id: 'paraguay', flag: '🇵🇾', trackColors: ['#D52B1E', '#FFFFFF', '#0038A8'], thumbEmoji: '⚽' },
  { id: 'germany', flag: '🇩🇪', trackColors: ['#1A1A1A', '#DD0000', '#FFCE00'], thumbEmoji: '⚽' },
  { id: 'morocco', flag: '🇲🇦', trackColors: ['#C1272D', '#006233', '#C1272D'], thumbEmoji: '⚽' },
  {
    id: 'netherlands',
    flag: '🇳🇱',
    trackColors: ['#AE1C28', '#FFFFFF', '#21468B'],
    thumbEmoji: '⚽',
  },
  { id: 'norway', flag: '🇳🇴', trackColors: ['#BA0C2F', '#FFFFFF', '#00205B'], thumbEmoji: '⚽' },
  {
    id: 'ivory_coast',
    flag: '🇨🇮',
    trackColors: ['#FF8200', '#FFFFFF', '#009A44'],
    thumbEmoji: '⚽',
  },
  { id: 'france', flag: '🇫🇷', trackColors: ['#0055A4', '#FFFFFF', '#EF4135'], thumbEmoji: '⚽' },
  { id: 'sweden', flag: '🇸🇪', trackColors: ['#006AA7', '#FECC02', '#006AA7'], thumbEmoji: '⚽' },
  { id: 'mexico', flag: '🇲🇽', trackColors: ['#006341', '#FFFFFF', '#C8102E'], thumbEmoji: '⚽' },
  { id: 'ecuador', flag: '🇪🇨', trackColors: ['#FFD100', '#0072CE', '#EF3340'], thumbEmoji: '⚽' },
  { id: 'england', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trackColors: ['#CE1124', '#FFFFFF', '#CE1124'], thumbEmoji: '⚽' },
  { id: 'dr_congo', flag: '🇨🇩', trackColors: ['#007FFF', '#F7D618', '#CE1021'], thumbEmoji: '⚽' },
  { id: 'belgium', flag: '🇧🇪', trackColors: ['#2D2926', '#FFCD00', '#C8102E'], thumbEmoji: '⚽' },
  { id: 'senegal', flag: '🇸🇳', trackColors: ['#00853F', '#FDEF42', '#E31B23'], thumbEmoji: '⚽' },
  { id: 'usa', flag: '🇺🇸', trackColors: ['#B31942', '#FFFFFF', '#0A3161'], thumbEmoji: '⚽' },
  { id: 'bosnia', flag: '🇧🇦', trackColors: ['#002F6C', '#FFCD00', '#002F6C'], thumbEmoji: '⚽' },
  { id: 'spain', flag: '🇪🇸', trackColors: ['#AA151B', '#F1BF00', '#AA151B'], thumbEmoji: '⚽' },
  { id: 'austria', flag: '🇦🇹', trackColors: ['#EF3340', '#FFFFFF', '#EF3340'], thumbEmoji: '⚽' },
  { id: 'portugal', flag: '🇵🇹', trackColors: ['#046A38', '#DA291C'], thumbEmoji: '⚽' },
  { id: 'croatia', flag: '🇭🇷', trackColors: ['#C8102E', '#FFFFFF', '#012169'], thumbEmoji: '⚽' },
  {
    id: 'switzerland',
    flag: '🇨🇭',
    trackColors: ['#DA291C', '#FFFFFF', '#DA291C'],
    thumbEmoji: '⚽',
  },
  { id: 'algeria', flag: '🇩🇿', trackColors: ['#006233', '#FFFFFF', '#D21034'], thumbEmoji: '⚽' },
  {
    id: 'australia',
    flag: '🇦🇺',
    trackColors: ['#012169', '#FFFFFF', '#E4002B'],
    thumbEmoji: '⚽',
  },
  { id: 'egypt', flag: '🇪🇬', trackColors: ['#CE1126', '#FFFFFF', '#1A1A1A'], thumbEmoji: '⚽' },
  {
    id: 'argentina',
    flag: '🇦🇷',
    trackColors: ['#74ACDF', '#F6B40E', '#74ACDF'],
    thumbEmoji: '⚽',
  },
  {
    id: 'cape_verde',
    flag: '🇨🇻',
    trackColors: ['#003893', '#FFFFFF', '#CF2027'],
    thumbEmoji: '⚽',
  },
  { id: 'colombia', flag: '🇨🇴', trackColors: ['#FCD116', '#003893', '#CE1126'], thumbEmoji: '⚽' },
  { id: 'ghana', flag: '🇬🇭', trackColors: ['#CE1126', '#FCD116', '#006B3F'], thumbEmoji: '⚽' },
  // Remaining 2026 qualifiers, appended (order irrelevant — sorted at render):
  { id: 'uruguay', flag: '🇺🇾', trackColors: ['#0038A8', '#FFFFFF', '#0038A8'], thumbEmoji: '⚽' },
  {
    id: 'south_korea',
    flag: '🇰🇷',
    trackColors: ['#FFFFFF', '#CD2E3A', '#0047A0'],
    thumbEmoji: '⚽',
  },
  { id: 'iran', flag: '🇮🇷', trackColors: ['#239F40', '#FFFFFF', '#DA0000'], thumbEmoji: '⚽' },
  { id: 'iraq', flag: '🇮🇶', trackColors: ['#CE1126', '#FFFFFF', '#000000'], thumbEmoji: '⚽' },
  {
    id: 'saudi_arabia',
    flag: '🇸🇦',
    trackColors: ['#006C35', '#FFFFFF', '#006C35'],
    thumbEmoji: '⚽',
  },
  { id: 'qatar', flag: '🇶🇦', trackColors: ['#8A1538', '#FFFFFF', '#8A1538'], thumbEmoji: '⚽' },
  { id: 'jordan', flag: '🇯🇴', trackColors: ['#000000', '#FFFFFF', '#007A3D'], thumbEmoji: '⚽' },
  {
    id: 'uzbekistan',
    flag: '🇺🇿',
    trackColors: ['#0099B5', '#FFFFFF', '#1EB53A'],
    thumbEmoji: '⚽',
  },
  { id: 'tunisia', flag: '🇹🇳', trackColors: ['#E70013', '#FFFFFF', '#E70013'], thumbEmoji: '⚽' },
  { id: 'curacao', flag: '🇨🇼', trackColors: ['#002B7F', '#F9E814', '#002B7F'], thumbEmoji: '⚽' },
  { id: 'haiti', flag: '🇭🇹', trackColors: ['#00209F', '#D21034'], thumbEmoji: '⚽' },
  { id: 'panama', flag: '🇵🇦', trackColors: ['#D21034', '#FFFFFF', '#005293'], thumbEmoji: '⚽' },
  {
    id: 'new_zealand',
    flag: '🇳🇿',
    trackColors: ['#00247D', '#FFFFFF', '#CC142B'],
    thumbEmoji: '⚽',
  },
  { id: 'czechia', flag: '🇨🇿', trackColors: ['#FFFFFF', '#D7141A', '#11457E'], thumbEmoji: '⚽' },
  {
    id: 'scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    trackColors: ['#005EB8', '#FFFFFF', '#005EB8'],
    thumbEmoji: '⚽',
  },
  { id: 'turkey', flag: '🇹🇷', trackColors: ['#E30A17', '#FFFFFF', '#E30A17'], thumbEmoji: '⚽' },
];

export function getSliderTheme(id: string | null | undefined): SliderTheme | null {
  if (!id) return null;
  return SLIDER_THEMES.find((theme) => theme.id === id) ?? null;
}

export function themeProductId(themeId: string): `theme_${string}` {
  return `${THEME_PRODUCT_PREFIX}${themeId}`;
}

/** Extract the theme id from a purchase's product_id, or null if it isn't a theme purchase. */
export function themeIdFromProductId(productId: string): string | null {
  return productId.startsWith(THEME_PRODUCT_PREFIX)
    ? productId.slice(THEME_PRODUCT_PREFIX.length)
    : null;
}
