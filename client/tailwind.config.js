/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slack: {
          sidebar: '#3f0e40',
          sidebarHover: '#350d36',
          accent: '#1164a3',
          border: '#522653',
          text: '#d1d2d3',
          muted: '#b39fb3',
        },
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
