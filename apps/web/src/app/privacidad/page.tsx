import { ConsentSettingsButton } from '@/components/ConsentSettingsButton';

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
          <li>Crear, mantener y proteger la cuenta de FutStats.</li>
          <li>Confirmar el correo y permitir recuperación o cambio de contraseña.</li>
          <li>Mantener la sesión y prevenir usos abusivos o automatizados.</li>
          <li>Sincronizar favoritos, watchlists, preferencias de alertas y estados personales que el usuario decida asociar a su cuenta.</li>
          <li>Gestionar suscripciones a notificaciones cuando el usuario las active expresamente.</li>
          <li>Medir el uso del producto únicamente cuando exista una herramienta de analítica documentada y el usuario haya aceptado esa categoría cuando sea la base aplicada.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Datos personales y almacenamiento</h2>
        <p>
          Si el usuario ha iniciado sesión, FutStats almacena en Supabase los datos necesarios para las funciones personales activadas, vinculados al identificador de Supabase Auth. Las tablas personales utilizan políticas de seguridad a nivel de fila para que una cuenta no pueda leer ni modificar datos de otra.
        </p>
        <p>
          FutStats puede mantener además datos funcionales en el navegador para respuesta inmediata de la interfaz, uso sin cuenta o conservación de preferencias. Al cerrar sesión se eliminan determinadas cachés personales para reducir el riesgo de exposición en dispositivos compartidos.
        </p>
        <p>
          Consulta la política de cookies para conocer las tecnologías necesarias, las categorías opcionales y cómo modificar una decisión de consentimiento.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Analítica y consentimiento</h2>
        <p>
          FutStats no carga actualmente una herramienta de analítica en el navegador. La categoría de analítica está desactivada por defecto y existe para que una futura integración no pueda iniciarse antes de una elección válida del usuario.
        </p>
        <p>
          Cuando se incorpore una herramienta concreta, esta política y la política de cookies deberán identificar el proveedor, la finalidad y la información relevante antes de comenzar el tratamiento. La decisión podrá modificarse o retirarse desde las preferencias de privacidad.
        </p>
        <ConsentSettingsButton />
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Proveedores técnicos</h2>
        <p>
          FutStats utiliza servicios de infraestructura y autenticación como Supabase y Vercel. Los datos personales de cuenta y funciones privadas se almacenan en Supabase, mientras que la base PostgreSQL de Neon se utiliza para los datos deportivos. Estos proveedores pueden tratar los datos técnicos necesarios para prestar sus servicios conforme a los contratos, medidas de seguridad y reglas de protección de datos que resulten aplicables.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7 text-pitch-subtle">
        <h2 className="font-display text-xl font-bold text-white">Derechos y retirada del consentimiento</h2>
        <p>
          Cuando resulte aplicable, las personas pueden ejercer los derechos reconocidos por la normativa de protección de datos, entre ellos acceso, rectificación, supresión, limitación, oposición y portabilidad. Cuando un tratamiento se base en consentimiento, este puede retirarse sin afectar a la licitud del tratamiento previo a la retirada.
        </p>
        <p>
          La retirada de una categoría opcional no debe impedir el uso de las funciones esenciales de FutStats. Las preferencias de analítica pueden modificarse desde esta página o desde la política de cookies.
        </p>
      </section>

      <section className="rounded-xl border border-pitch-warning/35 bg-pitch-warning/5 p-4 text-sm leading-6 text-pitch-muted">
        <strong className="text-white">Información legal pendiente:</strong> antes de una explotación comercial o captación abierta de usuarios debe completarse la identidad y los datos de contacto del responsable del tratamiento, el canal efectivo para ejercer derechos y, cuando corresponda, la información completa sobre transferencias internacionales, encargados del tratamiento, plazos de conservación y bases jurídicas aplicables. No se inventan esos datos porque deben corresponder al titular legal real de FutStats.
      </section>
    </article>
  );
}
