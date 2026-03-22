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
        sans: ['"Plus Jakarta Sans"', 'Lato', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
        'soft-lg': '0 12px 40px -12px rgba(15, 23, 42, 0.18), 0 4px 16px -4px rgba(15, 23, 42, 0.08)',
        glow: '0 0 0 1px rgba(139, 92, 246, 0.15), 0 8px 32px -8px rgba(109, 40, 217, 0.25)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'modal-in': 'modalIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        float: 'float 5s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
