import Link from 'next/link';
import { getCurrentEntitlement } from '@/lib/entitlements';
import {
  isStripeBillingConfigured,
  PREMIUM_DISPLAY_PRICE,
} from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Premium | Sports Intelligence',
  description:
    'Desbloquea CM Intelligence completo, filtros avanzados, búsquedas guardadas y alertas estadísticas con CornerMaximo Premium.',
  alternates: { canonical: '/pro' },
};

const PREMIUM_FEATURES = [
  'CM Intelligence completo sin límite de preview',
  'Filtros avanzados por frecuencia y tamaño de muestra',
  'Tendencias de equipos y jugadores',
  'Ventanas históricas ampliadas L5 / L10 / L20 / L30',
  'CM Scout y comparaciones avanzadas',
  'Búsquedas guardadas y alertas estadísticas',
  'Nuevos módulos Premium a medida que se publiquen',
];

const FREE_FEATURES = [
  'Partidos, equipos, jugadores y competiciones',
  'Preview de CM Intelligence',
  'Favoritos y funciones personales básicas',
  'Acceso a estadísticas esenciales',
];

const BILLING_MESSAGES: Record<string, string> = {
  'already-active': 'CornerMaximo Premium ya está activo en tu cuenta.',
  unavailable: 'Los pagos todavía no están disponibles. Inténtalo de nuevo más tarde.',
  'checkout-url-missing': 'Stripe no devolvió una página de pago. Inténtalo de nuevo.',
  'checkout-error': 'No hemos podido iniciar el pago. No se ha realizado ningún cargo.',
  'customer-missing': 'Aún no hay una cuenta de facturación que gestionar.',
  'portal-error': 'No hemos podido abrir la gestión de tu suscripción.',
};

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(date);
}

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; billing?: string }>;
}) {
  const [entitlement, params] = await Promise.all([
    getCurrentEntitlement(),
    searchParams,
  ]);
  const billingReady = isStripeBillingConfigured();
  const displayPrice =
    process.env.PREMIUM_MONTHLY_DISPLAY_PRICE?.trim() || PREMIUM_DISPLAY_PRICE;
  const periodEnd = formatPeriodEnd(entitlement.currentPeriodEnd);
  const feedback =
    params.checkout === 'success'
      ? 'Pago completado. Stripe está activando Premium en tu cuenta; puede tardar unos segundos.'
      : params.checkout === 'cancelled'
        ? 'Has cancelado el proceso de pago. No se ha realizado ningún cargo.'
        : params.billing
          ? BILLING_MESSAGES[params.billing]
          : null;

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="fs-panel border-pitch-accent/30 px-4 py-3 text-sm text-pitch-subtle" role="status">
          {feedback}
        </div>
      )}

      <header className="fs-panel relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-pitch-accent/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="fs-eyebrow">CORNERMAXIMO PREMIUM</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Más señales. Más contexto. Más control.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-pitch-muted sm:text-base">
            Premium está diseñado para usuarios que quieren explorar tendencias con más profundidad sin confundir frecuencia histórica con una predicción garantizada.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/intelligence" className="fs-btn-ghost">Probar CM Intelligence</Link>
            {entitlement.isPro ? (
              <form action="/api/billing/portal" method="POST">
                <button className="fs-btn-primary">Gestionar suscripción</button>
              </form>
            ) : !entitlement.isAuthenticated ? (
              <Link href="/auth/login?next=/pro" className="fs-btn-primary">Entrar para activar Premium</Link>
            ) : billingReady ? (
              <form action="/api/billing/checkout" method="POST">
                <button className="fs-btn-primary">Activar CornerMaximo Premium</button>
              </form>
            ) : (
              <span className="fs-chip border-pitch-accent/30 text-pitch-accent">Pagos en configuración</span>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          name="Free"
          price="0 €"
          description="Para seguir fútbol y probar la capa de inteligencia."
          features={FREE_FEATURES}
          highlighted={false}
          footer={<Link href="/intelligence" className="fs-btn-ghost w-full justify-center">Explorar gratis</Link>}
        />
        <PlanCard
          name="Premium"
          price={displayPrice}
          description="Una suscripción mensual. Sin permanencia; cancela cuando quieras."
          features={PREMIUM_FEATURES}
          highlighted
          footer={
            entitlement.isPro ? (
              <div className="rounded-lg border border-pitch-accent/30 bg-pitch-accent/10 px-4 py-3 text-center text-sm font-semibold text-pitch-accent">
                Premium activo
                {periodEnd && (
                  <span className="mt-1 block text-xs font-normal text-pitch-subtle">
                    {entitlement.cancelAtPeriodEnd ? `Acceso hasta el ${periodEnd}` : `Próxima renovación: ${periodEnd}`}
                  </span>
                )}
              </div>
            ) : !entitlement.isAuthenticated ? (
              <Link href="/auth/login?next=/pro" className="fs-btn-primary w-full justify-center">Iniciar sesión</Link>
            ) : billingReady ? (
              <form action="/api/billing/checkout" method="POST">
                <button className="fs-btn-primary w-full justify-center">Continuar al pago seguro</button>
              </form>
            ) : (
              <div className="rounded-lg border border-pitch-border bg-pitch-elevated px-4 py-3 text-center text-sm text-pitch-muted">Checkout preparado; falta activar la facturación.</div>
            )
          }
        />
      </section>

      <p className="text-center text-xs text-pitch-muted">
        Pago seguro procesado por Stripe. La suscripción se renueva cada mes hasta que la canceles.
      </p>

      <section className="fs-panel p-6 sm:p-8">
        <p className="fs-eyebrow">PRINCIPIOS DEL PRODUCTO</p>
        <h2 className="mt-2 text-2xl font-bold">El paywall no convierte datos débiles en datos premium</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Principle title="Muestra visible" text="Cada señal indica cuántos partidos cumplen el patrón y el tamaño de la ventana analizada." />
          <Principle title="NULL no es cero" text="Si el proveedor no ofrece una métrica, CornerMaximo la excluye de la muestra en lugar de inventar un valor." />
          <Principle title="Sin garantías" text="CM Confidence mide consistencia histórica. No representa una probabilidad futura ni garantiza un resultado." />
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  highlighted,
  footer,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted: boolean;
  footer: React.ReactNode;
}) {
  return (
    <article className={`fs-panel p-6 sm:p-8 ${highlighted ? 'border-pitch-accent/40 shadow-float' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="fs-eyebrow">{highlighted ? 'RECOMENDADO' : 'ACCESO'}</p>
          <h2 className="mt-2 text-3xl font-bold">{name}</h2>
        </div>
        {highlighted && <span className="fs-chip border-pitch-accent/30 text-pitch-accent">PREMIUM</span>}
      </div>
      <p className="mt-4 font-display text-2xl font-bold text-white">{price}</p>
      <p className="mt-2 text-sm text-pitch-muted">{description}</p>
      <ul className="mt-6 space-y-3 text-sm text-pitch-subtle">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden="true" className="text-pitch-accent">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">{footer}</div>
    </article>
  );
}

function Principle({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-elevated/50 p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-pitch-muted">{text}</p>
    </div>
  );
}
