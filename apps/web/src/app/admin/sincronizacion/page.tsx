import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SYNC_ADMIN_COOKIE, validSyncAdminSession } from '@/lib/adminSession';
import { getSyncDiagnostics } from '@/lib/syncDiagnostics';
import { authenticateSyncDashboard, endSyncDashboardSession } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Panel de sincronización',
  robots: { index: false, follow: false },
};

const ENTITY_LABEL: Record<string, string> = {
  COMPETITIONS: 'Competiciones',
  TEAMS: 'Equipos',
  SQUADS: 'Plantillas',
  FIXTURES: 'Calendarios',
  MATCH_DETAILS: 'Detalles de partido',
  PLAYER_MATCH_STATS: 'Estadísticas de jugadores',
  INJURIES: 'Lesiones',
  STANDINGS: 'Clasificaciones',
  NEWS: 'Noticias',
  TRANSFERS: 'Traspasos',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendientes',
  RUNNING: 'En ejecución',
  SUCCESS: 'Correctos',
  FAILED: 'Fallidos',
};

function formatDate(value: Date | string | null | undefined): string {
  if (value == null) return '—';
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  });
}

function LoginPanel({ error }: { error: string | undefined }) {
  const configurationError = error === 'configuracion';
  const rateLimitError = error === 'limite';
  return (
    <div className="mx-auto max-w-md py-12">
      <section className="fs-panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-grad-brand" />
        <p className="fs-eyebrow">Acceso restringido</p>
        <h1 className="mt-2 text-2xl font-bold">Panel de sincronización</h1>
        <p className="mt-3 text-sm leading-6 text-pitch-muted">
          Introduce el secreto de sincronización. Tras validarlo se crea una sesión HttpOnly firmada con una duración máxima de cuatro horas.
        </p>

        {error != null && (
          <p role="alert" className="mt-4 rounded-lg border border-pitch-danger/40 bg-pitch-danger/10 px-3 py-2 text-sm text-pitch-danger">
            {configurationError
              ? 'SYNC_SECRET no está configurado en este despliegue.'
              : rateLimitError
                ? 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.'
              : 'La credencial indicada no es válida.'}
          </p>
        )}

        <form action={authenticateSyncDashboard} className="mt-6 space-y-4">
          <div>
            <label htmlFor="sync-token" className="mb-1.5 block text-sm font-medium">
              Secreto de sincronización
            </label>
            <input
              id="sync-token"
              name="token"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2.5 text-sm outline-none transition focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/20"
            />
          </div>
          <button type="submit" className="fs-btn-primary w-full justify-center">
            Abrir panel
          </button>
        </form>
      </section>
    </div>
  );
}

export default async function SyncDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const hasSession = validSyncAdminSession(cookieStore.get(SYNC_ADMIN_COOKIE)?.value);
  if (!hasSession) return <LoginPanel error={error} />;

  const diagnostics = await getSyncDiagnostics();
  const budgetLimit = diagnostics.budgetToday.dailyLimit;
  const budgetUsed = diagnostics.budgetToday.used;
  const budgetPercent =
    budgetLimit != null && budgetLimit > 0
      ? Math.min(100, Math.round((budgetUsed / budgetLimit) * 100))
      : null;
  const queueCounts = new Map(
    diagnostics.queue.jobsByStatus.map((row) => [String(row.status), row._count._all]),
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="fs-eyebrow">Administración</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Sincronización y calidad</h1>
          <p className="mt-2 text-sm text-pitch-muted">
            Diagnóstico generado el {formatDate(diagnostics.generatedAt)}. Esta vista no ejecuta trabajos ni consume cuota del proveedor.
          </p>
        </div>
        <form action={endSyncDashboardSession}>
          <button type="submit" className="fs-btn-ghost">Cerrar sesión</button>
        </form>
      </header>

      <section aria-label="Estado principal" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat
          label="Estado público"
          value={
            diagnostics.publicHealth.level === 'OPERATIONAL'
              ? 'Normal'
              : diagnostics.publicHealth.level === 'DEGRADED'
                ? 'Degradado'
                : diagnostics.publicHealth.level === 'ATTENTION'
                  ? 'Atención'
                  : 'Desconocido'
          }
          detail={`${diagnostics.publicHealth.totals.competitionsNeedingReview} competiciones a revisar`}
        />
        <AdminStat
          label="Última estadística"
          value={formatDate(diagnostics.freshness.latestStatisticsAt)}
          detail={
            diagnostics.freshness.hoursSinceLatestStatistics == null
              ? 'Sin referencia temporal'
              : `Hace ${diagnostics.freshness.hoursSinceLatestStatistics} h`
          }
        />
        <AdminStat
          label="Partidos vencidos"
          value={String(diagnostics.queue.matchesPlayedWithoutResult)}
          detail="Siguen como programados o en directo"
        />
        <AdminStat
          label="Finalizados sin acta"
          value={String(diagnostics.queue.finishedMatchesWithoutStatistics)}
          detail="No contienen jugadores sincronizados"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="fs-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fs-eyebrow">Cuota del proveedor</p>
              <h2 className="mt-1 text-xl font-bold">Presupuesto de hoy</h2>
            </div>
            <span className="font-display text-2xl font-bold">
              {budgetUsed.toLocaleString('es-ES')}
              {budgetLimit != null ? ` / ${budgetLimit.toLocaleString('es-ES')}` : ''}
            </span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-pitch-elevated">
            <span
              aria-hidden="true"
              className="block h-full rounded-full bg-grad-brand"
              style={{ width: `${budgetPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-pitch-muted">
            {budgetPercent == null ? 'Límite diario no registrado.' : `${budgetPercent}% consumido.`}
          </p>
        </article>

        <article className="fs-panel p-5">
          <p className="fs-eyebrow">Cola de trabajo</p>
          <h2 className="mt-1 text-xl font-bold">Trabajos por estado</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'].map((status) => (
              <div key={status} className="rounded-lg border border-pitch-border/70 bg-pitch-bg/40 px-3 py-2">
                <dt className="text-2xs text-pitch-muted">{STATUS_LABEL[status]}</dt>
                <dd className="mt-1 font-display text-xl font-bold">{queueCounts.get(status) ?? 0}</dd>
              </div>
            ))}
          </dl>
          {diagnostics.queue.nextScheduled != null && (
            <p className="mt-4 text-xs text-pitch-muted">
              Próximo partido registrado: {diagnostics.queue.nextScheduled.season.competition.name} ·{' '}
              {formatDate(diagnostics.queue.nextScheduled.kickoffAt)}
            </p>
          )}
        </article>
      </section>

      {diagnostics.queue.runningJobs.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Trabajos en ejecución</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {diagnostics.queue.runningJobs.map((job) => (
              <article key={job.id} className="fs-panel p-4 text-sm">
                <p className="font-semibold">{ENTITY_LABEL[String(job.entity)] ?? String(job.entity)}</p>
                <p className="mt-1 text-xs text-pitch-muted">
                  Inicio: {formatDate(job.startedAt)} · Intento {job.attempts}
                </p>
                {job.entityExternalId != null && (
                  <p className="mt-1 break-all text-2xs text-pitch-muted">Referencia: {job.entityExternalId}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Último éxito por entidad</h2>
        <div className="overflow-x-auto rounded-xl border border-pitch-border">
          <table className="w-full min-w-[520px] bg-pitch-card text-sm">
            <thead className="text-left text-xs uppercase text-pitch-muted">
              <tr className="border-b border-pitch-border">
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Última ejecución correcta</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.lastSuccessByEntity.map((row) => (
                <tr key={String(row.entity)} className="border-b border-pitch-border/50 last:border-0">
                  <td className="px-4 py-3 font-medium">{ENTITY_LABEL[String(row.entity)] ?? String(row.entity)}</td>
                  <td className="px-4 py-3 text-pitch-muted">{formatDate(row._max.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">Trabajos fallidos recientes</h2>
            <span className="fs-chip">{diagnostics.failedJobs.length}</span>
          </div>
          <div className="space-y-3">
            {diagnostics.failedJobs.map((job) => (
              <article key={job.id} className="rounded-xl border border-pitch-danger/25 bg-pitch-danger/5 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{ENTITY_LABEL[String(job.entity)] ?? String(job.entity)}</p>
                  <time className="text-2xs text-pitch-muted">{formatDate(job.finishedAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-pitch-muted">
                  {job.error ?? 'El trabajo no registró un mensaje de error.'}
                </p>
                <p className="mt-2 text-2xs text-pitch-muted">Intentos: {job.attempts} · Prioridad: {job.priority}</p>
              </article>
            ))}
            {diagnostics.failedJobs.length === 0 && (
              <p className="fs-panel p-5 text-sm text-pitch-muted">No hay trabajos fallidos registrados.</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">Errores de log recientes</h2>
            <span className="fs-chip">{diagnostics.recentErrors.length}</span>
          </div>
          <div className="space-y-3">
            {diagnostics.recentErrors.map((log) => (
              <article key={log.id} className="fs-panel p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Log #{log.id}</p>
                  <time className="text-2xs text-pitch-muted">{formatDate(log.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-pitch-muted">{log.message}</p>
              </article>
            ))}
            {diagnostics.recentErrors.length === 0 && (
              <p className="fs-panel p-5 text-sm text-pitch-muted">No hay errores recientes en el registro.</p>
            )}
          </div>
        </div>
      </section>

      {diagnostics.dataConsistency.duplicateCurrentSeasons.length > 0 && (
        <section className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 p-5">
          <h2 className="font-semibold text-pitch-danger">Temporadas vigentes duplicadas</h2>
          <ul className="mt-3 space-y-2 text-sm text-pitch-muted">
            {diagnostics.dataConsistency.duplicateCurrentSeasons.map((seasons) => (
              <li key={seasons[0]?.competitionId}>
                {seasons[0]?.competition.name}: {seasons.map((season) => season.year).join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AdminStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="fs-panel p-4">
      <p className="text-2xs font-semibold uppercase tracking-wide text-pitch-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-pitch-muted">{detail}</p>
    </article>
  );
}
