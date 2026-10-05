import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig.json declara "jsx": "preserve" porque Next compila el JSX por su
  // cuenta. Vitest 5 respeta esa opción y dejaba el JSX sin transformar, así
  // que aquí se fuerza el runtime automático de React solo para los tests.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    // El mismo alias que tsconfig ("@/*" -> "./src/*"), para que un módulo
    // probado pueda importar con "@/..." sin tener que simularlo.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
