import type { Config } from 'tailwindcss';

function token(name: string): string { return `rgb(var(${name}) / <alpha-value>)`; }

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { pitch: {
      bg: token('--pitch-bg'), card: token('--pitch-card'), elevated: token('--pitch-elevated'),
      border: token('--pitch-border'), 'border-strong': token('--pitch-border-strong'),
      accent: token('--pitch-accent'), accent2: token('--pitch-accent-2'), accent3: token('--pitch-accent-3'),
      danger: token('--pitch-danger'), warning: token('--pitch-warning'), muted: token('--pitch-muted'), subtle: token('--pitch-subtle'),
    }},
    fontFamily: { sans: ['var(--font-sans)','ui-sans-serif','system-ui','sans-serif'], display: ['var(--font-display)','var(--font-sans)','ui-sans-serif','system-ui','sans-serif'] },
    fontSize: { '2xs': ['0.6875rem',{ lineHeight:'1rem' }] }, screens: { xs:'420px' }, borderRadius: { '4xl':'2rem' },
    boxShadow: {
      panel:'0 1px 0 0 rgb(255 255 255 / .035) inset, 0 14px 34px -18px rgb(0 0 0 / .9)',
      float:'0 1px 0 0 rgb(255 255 255 / .05) inset, 0 24px 56px -16px rgb(0 0 0 / .9)',
      glow:'0 0 0 1px rgb(var(--pitch-accent) / .28), 0 10px 34px -14px rgb(var(--pitch-accent) / .45)',
      'glow-soft':'0 10px 36px -18px rgb(var(--pitch-accent) / .5)',
    },
    backgroundImage: {
      'grad-brand':'linear-gradient(105deg, rgb(var(--pitch-accent)) 0%, rgb(var(--pitch-accent-3)) 48%, rgb(var(--pitch-danger)) 100%)',
      'grad-surface':'linear-gradient(180deg, rgb(255 255 255 / .035) 0%, rgb(255 255 255 / 0) 48%)',
      'grad-mesh':'radial-gradient(52rem 30rem at 10% -10%, rgb(var(--pitch-accent) / .11), transparent 62%), radial-gradient(48rem 28rem at 95% 5%, rgb(var(--pitch-danger) / .07), transparent 62%)',
    },
    keyframes: { 'fade-up': { from:{opacity:'0',transform:'translateY(6px)'}, to:{opacity:'1',transform:'translateY(0)'} } },
    animation: { 'fade-up':'fade-up .35s ease-out both' },
  }}, plugins: [],
} satisfies Config;
