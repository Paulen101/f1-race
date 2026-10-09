const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#E10600',
          'red-bright': '#FF2A1F',
          dark: '#0B0B10',
          gray: '#16161D',
          panel: '#121218',
          line: 'rgba(255, 255, 255, 0.08)',
          white: '#FFFFFF',
          cyan: '#22D3EE',
          purple: '#A855F7',
        },
      },
      fontFamily: {
        sans: ['"Titillium Web"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(225, 6, 0, 0.4), 0 8px 30px -8px rgba(225, 6, 0, 0.6)',
        panel: '0 24px 48px -24px rgba(0, 0, 0, 0.7)',
      },
      animation: {
        'star-movement-bottom': 'star-movement-bottom linear infinite alternate',
        'star-movement-top': 'star-movement-top linear infinite alternate',
        'fade-up': 'fade-up 0.5s ease-out both',
      },
      keyframes: {
        'star-movement-bottom': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(-100%, 0%)', opacity: '0' },
        },
        'star-movement-top': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(100%, 0%)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
