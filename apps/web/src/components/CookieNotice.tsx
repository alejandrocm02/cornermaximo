'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readConsent, writeConsent } from '@/lib/consent';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const current = readConsent();
    if (current == null) {
      setVisible(true);
    } else {
      setAnalytics(current.analytics);
    }

    const openSettings = () => {
      const latest = readConsent();
      setAnalytics(latest?.analytics ?? false);
      setSettings(true);
      setVisible(true);
    };
    window.addEventListener('futstats:open-consent-settings', openSettings);
    return () => window.removeEventListener('futstats:open-consent-settings', openSettings);
  }, []);

  function save(nextAnalytics: boolean) {
    writeConsent({ analytics: nextAnalytics, advertising: false });
    setAnalytics(nextAnalytics);
    setVisible(false);
    setSettings(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Preferencias de privacidad"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-pitch-border bg-pitch-card/95 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:p-5"
    >
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Tu privacidad en FutStats</h2>
          <p className="mt-1 text-sm leading-6 text-pitch-subtle">
            Las tecnologías necesarias para sesión, seguridad y preferencias básicas funcionan siempre. La analítica es opcional y permanece desactivada hasta que la aceptes. No hay publicidad comportamental activa. Puedes cambiar tu decisión en cualquier momento.{' '}
            <Link href="/cookies" className="font-semibold text-pitch-accent hover:underline">Política de cookies</Link>.
          </p>
        </div>

        {settings && (
          <div className="space-y-3 rounded-xl border border-pitch-border bg-pitch-bg/45 p-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">Necesarias</p>
                <p className="mt-1 text-xs leading-5 text-pitch-muted">Sesión, seguridad, prevención de abuso y almacenamiento de tu elección de privacidad.</p>
              </div>
              <span className="fs-chip">Siempre activas</span>
            </div>
            <label className="flex items-start justify-between gap-4 border-t border-pitch-border/60 pt-3">
              <span>
                <span className="font-semibold text-white">Analítica</span>
                <span className="mt-1 block text-xs leading-5 text-pitch-muted">Medición de uso para mejorar FutStats. Ningún servicio de analítica se cargará sin esta autorización.</span>
              </span>
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-5 w-5" />
            </label>
            <div className="flex items-start justify-between gap-4 border-t border-pitch-border/60 pt-3 opacity-70">
              <div>
                <p className="font-semibold text-white">Publicidad</p>
                <p className="mt-1 text-xs leading-5 text-pitch-muted">No implementada. Si se incorpora, se informará del proveedor y finalidad y se solicitará una decisión específica nueva.</p>
              </div>
              <span className="fs-chip">No disponible</span>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => save(false)} className="fs-btn-ghost justify-center">Rechazar analítica</button>
          {settings ? (
            <button type="button" onClick={() => save(analytics)} className="fs-btn-ghost justify-center">Guardar selección</button>
          ) : (
            <button type="button" onClick={() => setSettings(true)} className="fs-btn-ghost justify-center">Configurar</button>
          )}
          <button type="button" onClick={() => save(true)} className="fs-btn-primary justify-center">Aceptar analítica</button>
        </div>
      </div>
    </aside>
  );
}
