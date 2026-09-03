/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // DESIGN.md semantic tokens
      colors: {
        surface: {
          base: '#000000',    // color.surface.base
          raised: '#0a0a0a',  // color.surface.raised
          muted: '#171717',   // color.surface.muted
        },
        text: {
          primary: '#ededed', // color.text.primary
          secondary: '#bababa', // color.text.secondary
          tertiary: '#a1a1aa', // color.text.tertiary
          inverse: '#7d7d7d',  // color.text.inverse
        },
        border: {
          strong: '#ffffff',   // color.border.strong
          default: '#e5e7eb',  // color.border.default
          muted: '#2e2e2e',    // color.border.muted
        },
        accent: {
          DEFAULT: '#dc2626', // brand accent (red)
          hover: '#ef4444',
          maroon: '#800020',   // deep maroon
          maroonLight: '#a4123c', // maroon mid
          maroonDark: '#5c0e16',  // maroon shadow
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Inter Fallback',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],
      },
      fontSize: {
        // DESIGN.md typography scale
        'xs': ['9px', { lineHeight: '1.4' }],
        'sm': ['10px', { lineHeight: '1.5' }],
        'md': ['11px', { lineHeight: '1.5' }],
        'lg': ['12px', { lineHeight: '1.6' }],
        'xl': ['13px', { lineHeight: '1.6' }],
        '2xl': ['13.4px', { lineHeight: '1.6' }],
        '3xl': ['14px', { lineHeight: '1.6' }],
        '4xl': ['16px', { lineHeight: '1.6' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '5px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '9999px',
      },
      transitionDuration: {
        instant: '150ms',  // motion.duration.instant
        fast: '200ms',     // motion.duration.fast
        normal: '300ms',   // motion.duration.normal
      },
    },
  },
  plugins: [],
}
