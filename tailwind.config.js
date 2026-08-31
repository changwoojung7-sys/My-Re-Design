/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* 레거시 호환 */
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary:    "var(--primary)",
        secondary:  "var(--secondary)",
        accent:     "var(--accent)",
        /* 배경 레이어 */
        'bg-base':     "var(--bg-base)",
        'bg-surface':  "var(--bg-surface)",
        'bg-elevated': "var(--bg-elevated)",
        'bg-glass':    "var(--bg-glass)",
        /* 브랜드 */
        'brand-mint': "var(--brand-mint)",
        'brand-lime': "var(--brand-lime)",
        /* 4대 카테고리 */
        'cat-body':    "var(--cat-body)",
        'cat-mind':    "var(--cat-mind)",
        'cat-growth':  "var(--cat-growth)",
        'cat-funplay': "var(--cat-funplay)",
        /* 텍스트 */
        'text-primary':   "var(--text-primary)",
        'text-secondary': "var(--text-secondary)",
        'text-muted':     "var(--text-muted)",
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'card':    '24px',
        'card-sm': '16px',
        'badge':   '12px',
      },
      boxShadow: {
        'neon-mint':    '0 0 16px rgba(20,184,166,0.25), 0 0 4px rgba(20,184,166,0.4)',
        'neon-body':    '0 0 16px rgba(251,113,133,0.25), 0 0 4px rgba(251,113,133,0.3)',
        'neon-mind':    '0 0 16px rgba(167,139,250,0.25), 0 0 4px rgba(167,139,250,0.3)',
        'neon-growth':  '0 0 16px rgba(56,189,248,0.25),  0 0 4px rgba(56,189,248,0.3)',
        'neon-funplay': '0 0 16px rgba(251,146,60,0.25), 0 0 4px rgba(251,146,60,0.3)',
        'card':         '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':   '0 8px 40px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        card: '16px',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16,185,129,0.25)' },
          '50%':       { boxShadow: '0 0 24px rgba(16,185,129,0.4), 0 0 48px rgba(16,185,129,0.15)' },
        },
        'flame-shake': {
          '0%, 100%': { transform: 'rotate(-3deg) scale(1)' },
          '25%':       { transform: 'rotate(3deg) scale(1.05)' },
          '75%':       { transform: 'rotate(-2deg) scale(1.02)' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        'fill-bar': {
          from: { width: '0%' },
        },
      },
      animation: {
        'neon-pulse':  'neon-pulse 2s ease-in-out infinite',
        'flame':       'flame-shake 0.6s ease-in-out infinite',
        'slide-up':    'slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'shimmer':     'shimmer 1.8s linear infinite',
        'fill-bar':    'fill-bar 1s ease-out forwards',
      },
    },
  },
  plugins: [],
}
