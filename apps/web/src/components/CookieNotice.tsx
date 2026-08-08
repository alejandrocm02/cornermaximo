'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'futstats.cookieNotice.dismissed.v1';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Si el navegador bloquea localStorage, el aviso simplemente puede reaparecer.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Información sobre cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-pitch-border bg-pitch-card/95 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-pitch-subtle">
          FutStats usa únicamente cookies técnicamente necesarias para iniciar sesión y proteger la cuenta. No usamos cookies publicitarias ni de analítica en esta versión.{' '}
          <Link href="/cookies" className="font-semibold text-pitch-accent hover:underline">
            Ver política de cookies
          </Link>
          .
        </p>
        <button type="button" onClick={dismiss} className="fs-btn-primary shrink-0 justify-center">
          Entendido
        </button>
      </div>
    </aside>
  );
}
