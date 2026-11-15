/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf3', 100: '#d8f3e1', 200: '#b4e6c6', 300: '#82d3a3', 400: '#4fb97d',
          500: '#2c9d62', 600: '#1e7e4e', 700: '#196441', 800: '#175035', 900: '#14422d',
        },
        ink: { 900: '#14201a', 700: '#34443b', 500: '#5d6d64', 300: '#a7b3ac', 100: '#e8eeea', 50: '#f6f8f6' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
