import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Los comandos del workspace se ejecutan desde packages/db; la configuración
// local documentada vive en el .env de la raíz. En CI/Vercel las variables ya
// están inyectadas y dotenv no sobrescribe esos valores.
loadEnv({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Las operaciones de esquema evitan el pooler de Neon.
    // El fallback solo apunta al Postgres local documentado; nunca permite que
    // un comando sin configurar alcance accidentalmente la base de producción.
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://cornermaximo:cornermaximo@127.0.0.1:5432/cornermaximo',
  },
});
