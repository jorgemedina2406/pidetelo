/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Rich Slate-Navy dark palette + High-contrast light canvas palette
        slate: {
          50: '#f4f6fa',  // Warm-cool textured background for Light mode (clean separation from white cards)
          100: '#e8edf5', // Surface contrast / light borders
          200: '#d5dfec',
          300: '#9fb1cc',
          400: '#7588a6',
          500: '#536785',
          600: '#3d4e68',
          700: '#2c394e',
          750: '#232f42',
          800: '#1f2a3d', // Dark borders
          850: '#192233', // Dark elevated surface
          900: '#131c2b', // Dark card surface (rich deep navy-charcoal, not dead black)
          950: '#0d131e', // Base canvas for dark mode
        },
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Vibrant Delivery Orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        whatsapp: {
          DEFAULT: '#25D366',
          dark: '#128C7E',
          light: '#DCF8C6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '6px',
        'lg': '8px',
        'xl': '10px',
        '2xl': '12px',
        'full': '9999px',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
