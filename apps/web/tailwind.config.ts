import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño FutStats — estética futurista, profesional y deportiva.
 *
 * Los colores se declaran como variables CSS (definidas en globals.css) en vez
 * de valores literales. Esto permite:
 *  - reutilizar los mismos nombres de token (`pitch-*`) que ya usa toda la app,
 *    de modo que el rediseño se propaga sin reescribir cada vista;
 *  - preparar un futuro modo claro cambiando solo las variables;
 *  - componer opacidades de Tailwind (`bg-pitch-card/60`) gracias al formato
 *    `<r> <g> <b>` y a la función `rgb(var(--token) / <alpha-value>)`.
 */
function token(name: string): string {
  return `rgb(var(${name}) / <alpha-value>)`;
}

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          /** Fondo base de la aplicación. */
          bg: token('--pitch-bg'),
          /** Superficie elevada por defecto (tarjetas, paneles). */
          card: token('--pitch-card'),
          /** Superficie un nivel por encima (cabeceras de tabla, chips). */
          elevated: token('--pitch-elevated'),
          /** Borde sutil de separación. */
          border: token('--pitch-border'),
          /** Borde con más presencia para elementos interactivos. */
          'border-strong': token('--pitch-border-strong'),
          /** Acento principal de marca (verde eléctrico). */
          accent: token('--pitch-accent'),
          /** Acento secundario para degradados y visualización de datos. */
          accent2: token('--pitch-accent-2'),
          /** Acento terciario, para destacar sin competir con el principal. */
          accent3: token('--pitch-accent-3'),
          danger: token('--pitch-danger'),
          warning: token('--pitch-warning'),
          muted: token('--pitch-muted'),
          /** Texto secundario con algo más de contraste que `muted`. */
          subtle: token('--pitch-subtle'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      screens: {
        xs: '420px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        /** Elevación estándar de tarjeta sobre fondo oscuro. */
        panel: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -12px rgb(0 0 0 / 0.7)',
        /** Elevación de elementos flotantes (menús, popovers). */
        float: '0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 24px 56px -16px rgb(0 0 0 / 0.85)',
        /** Halo del acento principal para estados activos o destacados. */
        glow: '0 0 0 1px rgb(var(--pitch-accent) / 0.35), 0 8px 32px -8px rgb(var(--pitch-accent) / 0.45)',
        'glow-soft': '0 8px 40px -12px rgb(var(--pitch-accent) / 0.35)',
      },
      backgroundImage: {
        /** Degradado de marca para titulares y elementos destacados. */
        'grad-brand':
          'linear-gradient(100deg, rgb(var(--pitch-accent)) 0%, rgb(var(--pitch-accent-2)) 55%, rgb(var(--pitch-accent-3)) 100%)',
        /** Relleno sutil de superficie con luz cenital. */
        'grad-surface': 'linear-gradient(180deg, rgb(255 255 255 / 0.05) 0%, rgb(255 255 255 / 0) 45%)',
        /** Malla ambiental del fondo de la aplicación. */
        'grad-mesh':
          'radial-gradient(60rem 40rem at 15% -10%, rgb(var(--pitch-accent) / 0.14), transparent 60%), radial-gradient(50rem 35rem at 90% 0%, rgb(var(--pitch-accent-2) / 0.12), transparent 55%), radial-gradient(45rem 30rem at 50% 110%, rgb(var(--pitch-accent-3) / 0.10), transparent 60%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
