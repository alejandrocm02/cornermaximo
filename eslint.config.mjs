import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    settings: {
      next: {
        rootDir: new URL('./apps/web/', import.meta.url).pathname,
      },
    },
    rules: {
      // React Compiler no está habilitado. Estas reglas de "recommended-latest"
      // clasifican como render efectos legítimos de hidratación/localStorage y
      // callbacks de eventos; se mantienen activas el resto de reglas de Hooks.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
  },
  globalIgnores([
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/next-env.d.ts',
    'supabase/.temp/**',
  ]),
]);

export default eslintConfig;
