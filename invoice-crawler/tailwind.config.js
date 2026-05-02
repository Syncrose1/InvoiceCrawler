/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ice: {
          bg: '#0a0a0f',
          surface: '#12121a',
          'surface-2': '#1a1a24',
          border: '#2a2a38',
          'border-glow': '#3a3a4f',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          accent: '#60a5fa',
          'accent-glow': '#3b82f6',
          'accent-soft': '#1e3a5f',
          danger: '#f87171',
          success: '#4ade80',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        ice: '20px',
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(96, 165, 250, 0.15)',
        'glow-md': '0 0 24px rgba(96, 165, 250, 0.25)',
        'glow-lg': '0 0 40px rgba(96, 165, 250, 0.3)',
        'inner-ice': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(96, 165, 250, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(96, 165, 250, 0.4)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
