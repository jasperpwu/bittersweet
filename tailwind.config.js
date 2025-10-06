/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6592E9',
        'primary-disabled': '#6592E9',
        link: '#438EEC',
        success: '#51BC6F',
        error: '#EF786C',
        'text-grey': '#CACACA',
        
        // Light mode
        'light-text-primary': '#4C4C4C',
        'light-text-secondary': '#8A8A8A',
        'light-border': '#E1E1E1',
        'light-bg': '#FFFFFF',
        
        // Dark mode
        'dark-text-primary': '#FFFFFF',
        'dark-text-secondary': '#CACACA',
        'dark-border': '#575757',
        'dark-bg': '#1B1C30',
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
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
      },
    },
  },
  plugins: [],
};
