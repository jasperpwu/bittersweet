/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6592E9',
        'primary-disabled': '#6592E9',
        'primary-soft': '#6592E926',
        'primary-soft-20': '#6592E933',
        'primary-soft-10': '#6592E91A',
        link: '#438EEC',
        success: '#51BC6F',
        error: '#EF786C',
        // Destructive actions (delete/remove) — a brighter, higher-contrast red
        // than the soft `error` coral. Replaces scattered #DC2626/#EF4444/#E57373.
        danger: '#EF4444',
        warning: '#FCD34D',
        'text-grey': '#CACACA',

        // Light-mode-safe variants for semantic colors on cream bg
        'success-light': '#2E7D32',
        'error-light': '#C62828',
        'primary-light': '#3B6BBF',

        // Challenge accent — the same coral as `error` / the inner circle, in
        // both schemes so the two social features read as one accent. Keep in
        // sync with `challenge` in src/config/theme.ts.
        challenge: '#EF786C',

        // Light mode — warm/earthy (aligned with widget)
        'light-text-primary': '#5D4E37',
        'light-text-secondary': '#6B5A42',
        'light-border': '#D4C4A8',
        'light-bg': '#F5E6D3',
        // Text input / editor surface on the cream screen.
        'light-input': '#F0E0CC',

        // Dark mode
        'dark-text-primary': '#FFFFFF',
        'dark-text-secondary': '#CACACA',
        'dark-border': '#575757',
        'dark-bg': '#1B1C30',
        // Elevated card/surface on the dark screen — one canonical value that
        // replaces the scattered #242540 / #2A2B45 / #2A2B4A literals.
        'dark-card': '#242540',
        // Text input / editor surface on the dark screen.
        'dark-input': '#2A2A2A',
      },
      fontFamily: {
        'poppins-regular': ['Poppins-Regular'],
        'poppins-medium': ['Poppins-Medium'],
        'poppins-semibold': ['Poppins-SemiBold'],
        'poppins-bold': ['Poppins-Bold'],
      },
      fontSize: {
        'headline-24': ['24px', '34px'],
        'headline-20': ['20px', '28px'],
        'headline-18': ['18px', '26px'],
        'subtitle-16': ['16px', '22px'],
        'subtitle-14': ['14px', '20px'],
        'body-14': ['14px', '20px'],
        'paragraph-14': ['14px', '24px'],
        'body-12': ['12px', '18px'],
        'tiny-10': ['10px', '16px'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
      },
    },
  },
  plugins: [],
};
