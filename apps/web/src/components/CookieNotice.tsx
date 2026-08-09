'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readConsent, writeConsent } from '@/lib/consent';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const current = readConsent();
    if (current == null) {
      setVisible(true);
    } else {
      setAnalytics(current.analytics);
      setAdvertising(current.advertising);
    }

    const openSettings = () => {
      const latest = readConsent();
      setAnalytics(latest?.analytics ?? false);
      setAdvertising(latest?.advertising ?? false);
      setSettings(true);
      setVisible(true);
    };
    window.addEventListener('futstats:open-consent-settings', openSettings);
    return () => window.removeEventListener('futstats:open-consent-settings', openSettings);
  }, []);

  function save(nextAnalytics: boolean, nextAdvertising: boolean) {
    writeConsent({ analytics: nextAnalytics, advertising: nextAdvertising });
    setAnalytics(nextAnalytics);
    setAdvertising(nextAdvertising);
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
            Las tecnologías necesarias para sesión, seguridad y preferencias básicas funcionan siempre. La analítica y la publicidad son opcionales y permanecen desactivadas hasta que las aceptes. Puedes cambiar tu decisión en cualquier momento.{' '}
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
                <span className="mt-1 block text-xs leading-5 text-pitch-muted">Medición de uso para mejorar FutStats. No se cargará ningún servicio de analítica sin esta autorización.</span>
              </span>
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-5 w-5" />
            </label>
            <label className="flex items-start justify-between gap-4 border-t border-pitch-border/60 pt-3">
              <span>
                <span className="font-semibold text-white">Publicidad</span>
                <span className="mt-1 block text-xs leading-5 text-pitch-muted">Tecnologías publicitarias o de medición asociada. Permanecerán desactivadas hasta una futura implementación y solo con consentimiento.</span>
              </span>
              <input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} className="mt-1 h-5 w-5" />
            </label>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => save(false, false)} className="fs-btn-ghost justify-center">Rechazar opcionales</button>
          {settings ? (
            <button type="button" onClick={() => save(analytics, advertising)} className="fs-btn-ghost justify-center">Guardar selección</button>
          ) : (
            <button type="button" onClick={() => setSettings(true)} className="fs-btn-ghost justify-center">Configurar</button>
          )}
          <button type="button" onClick={() => save(true, true)} className="fs-btn-primary justify-center">Aceptar opcionales</button>
        </div>
      </div>
    </aside>
  );
}
