/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          deep:    '#07080d',
          card:    '#0e1018',
          raised:  '#13161f',
          muted:   '#0b0c14',
        },
        ink: {
          1: '#eef2f7',
          2: '#8a9ab5',
          3: '#3d4a61',
          4: '#1e2535',
        },
        amber: {
          glow:  '#f59e0b',
          deep:  '#d97706',
          faint: 'rgba(245,158,11,0.12)',
        },
        indigo: {
          glow: '#6366f1',
          faint: 'rgba(99,102,241,0.12)',
        },
        emerald: {
          glow: '#10b981',
        },
        danger: '#ef4444',
        caution: '#f97316',
        violet: '#a855f7',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.07)',
        amber:  'rgba(245,158,11,0.25)',
      },
      boxShadow: {
        card:  '0 4px 24px rgba(0,0,0,0.4)',
        amber: '0 8px 24px rgba(245,158,11,0.25)',
        glow:  '0 0 0 3px rgba(99,102,241,0.15)',
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease forwards',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
