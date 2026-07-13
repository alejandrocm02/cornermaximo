import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          bg: '#0E1420',
          card: '#161F2E',
          border: '#243044',
          accent: '#22C55E',
          danger: '#EF4444',
          muted: '#8A99B0',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
