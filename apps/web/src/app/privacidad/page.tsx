export const metadata = {
  title: 'Política de privacidad',
  description: 'Política de privacidad de FutStats.',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-6">
      <div>
        <p className="fs-eyebrow">Privacidad</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Política de privacidad</h1>
      </div>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <p>
          FutStats permite crear una cuenta mediante correo electrónico. La autenticación se presta con Supabase Auth, que gestiona las credenciales, la confirmación de correo, la recuperación de contraseña y las sesiones. FutStats no almacena ni puede recuperar la contraseña original del usuario.
        </p>
        <p>
          Para prestar la cuenta se tratan, como mínimo, el correo electrónico, un identificador técnico de usuario, fechas y metadatos de autenticación necesarios para seguridad y funcionamiento de la sesión. Los datos deportivos públicos de jugadores, clubes y competiciones se mantienen separados de los datos personales del usuario.
        </p>
      </section>

      <section className="fs-panel p-5 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Finalidades</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-pitch-muted">
          <li>Crear y proteger la cuenta de FutStats.</li>
          <li>Confirmar el correo y permitir recuperación o cambio de contraseña.</li>
          <li>Mantener la sesión y prevenir usos abusivos o automatizados del sistema de autenticación.</li>
          <li>Sincronizar de forma privada los favoritos que el usuario decida asociar a su cuenta.</li>
          <li>Prestar otras funciones personales que el usuario solicite cuando se incorporen a la cuenta.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Favoritos y almacenamiento en el dispositivo</h2>
        <p>
          Si el usuario ha iniciado sesión, FutStats almacena en Supabase el tipo de favorito, el identificador público de la entidad deportiva y los datos de presentación necesarios para mostrarlo. Estas filas se vinculan al identificador de Supabase Auth y están protegidas mediante políticas de seguridad a nivel de fila para que cada cuenta solo pueda acceder a sus propios datos.
        </p>
        <p>
          FutStats mantiene además una copia local de los favoritos en el navegador para respuesta inmediata de la interfaz y para permitir favoritos a visitantes sin cuenta. Cuando una cuenta se utiliza por primera vez tras esta actualización, los favoritos locales existentes pueden migrarse a esa cuenta. Al cerrar sesión se limpia la caché local de favoritos vinculada a la sesión para reducir el riesgo de exposición en dispositivos compartidos.
        </p>
        <p>
          Otras funciones, como determinados datos del Analizador y algunas preferencias, pueden seguir permaneciendo únicamente en el almacenamiento local del navegador. Consulta la política de cookies para conocer qué se guarda en cookies y qué se mantiene localmente.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Proveedores técnicos</h2>
        <p>
          FutStats utiliza servicios de infraestructura y autenticación como Supabase y Vercel. Los datos personales de cuenta y favoritos se almacenan en Supabase, mientras que la base PostgreSQL de Neon se utiliza para los datos deportivos. Estos proveedores pueden tratar los datos técnicos necesarios para prestar sus servicios conforme a sus propias condiciones y medidas de seguridad.
        </p>
      </section>

      <section className="rounded-xl border border-pitch-warning/35 bg-pitch-warning/5 p-4 text-sm leading-6 text-pitch-muted">
        <strong className="text-white">Información legal pendiente:</strong> antes de una explotación comercial o captación abierta de usuarios debe completarse aquí la identidad y los datos de contacto del responsable del tratamiento, así como el canal para ejercer derechos de acceso, rectificación, supresión y demás derechos aplicables. No se inventan esos datos en esta página porque deben corresponder al titular legal real de FutStats.
      </section>
    </article>
  );
}
