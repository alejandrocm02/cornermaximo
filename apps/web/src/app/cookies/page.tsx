export const metadata = {
  title: 'Política de cookies',
  description: 'Información sobre las cookies y almacenamiento local utilizados por FutStats.',
  robots: { index: false },
};

export default function CookiesPage() {
  return (
    <article className="max-w-3xl space-y-6">
      <div>
        <p className="fs-eyebrow">Privacidad</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Política de cookies</h1>
      </div>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <p>
          FutStats utiliza cookies técnicamente necesarias para mantener el inicio de sesión y renovar de forma segura la sesión de las cuentas. Estas cookies se gestionan mediante Supabase Auth y no se utilizan para publicidad, elaboración de perfiles ni analítica de comportamiento.
        </p>
        <p>
          Al ser necesarias para prestar la función de cuenta solicitada por el usuario, no se ofrece un interruptor para desactivarlas desde FutStats. Puedes eliminarlas desde la configuración de tu navegador; al hacerlo, se cerrará la sesión.
        </p>
      </section>

      <section className="fs-panel p-5">
        <h2 className="font-display text-xl font-bold">Cookies y almacenamiento utilizados</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-white">Sesión de Supabase Auth</dt>
            <dd className="mt-1 text-pitch-muted">
              Cookies cuyo nombre comienza normalmente por <code>sb-</code>. Mantienen y renuevan la sesión autenticada. Su contenido son tokens de sesión; FutStats no almacena la contraseña original en estas cookies.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">Sesión del panel administrativo</dt>
            <dd className="mt-1 text-pitch-muted">
              <code>futstats_sync_admin</code>, limitada al área administrativa, HttpOnly, SameSite Strict y Secure en producción. Caduca como máximo a las cuatro horas.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">Almacenamiento local</dt>
            <dd className="mt-1 text-pitch-muted">
              Favoritos, determinadas preferencias, datos del Analizador y el estado de lectura de avisos pueden mantenerse en <code>localStorage</code> del navegador. No son cookies y permanecen en el dispositivo hasta que el usuario los elimina o borra los datos del sitio.
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Cookies opcionales</h2>
        <p>
          Esta versión no instala cookies de publicidad ni de analítica. Si en el futuro se incorporan tecnologías no esenciales, FutStats deberá solicitar consentimiento antes de activarlas y permitir rechazarlas con la misma facilidad con la que se aceptan.
        </p>
      </section>
    </article>
  );
}
