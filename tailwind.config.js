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
        'blur-in': 'blur-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-in': 'slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      // Only the start state is defined: each element animates back to its own
      // styles, so things like a dimmed calendar card keep their opacity.
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
        },
        // Results resolve out of a blur, like a signal coming in
        'blur-in': {
          '0%': { opacity: '0', filter: 'blur(12px)', transform: 'translateY(16px) scale(0.98)' },
        },
        // Numbers pop in with a slight overshoot
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
        },
        // Table rows slide in from the left, like a timing tower filling up
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
        },
      },
    },
  },
  plugins: [],
}
