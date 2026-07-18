'use client';

/**
 * Indicador de actualidad del feed: "Actualizado hace X minutos" + aviso de
 * noticias nuevas con botón para cargarlas. Sondeo suave cada 2 minutos,
 * pausado cuando la pestaña no está visible. No desplaza el contenido.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { timeAgo } from '@/lib/marketLabels';

const POLL_MS = 120_000;

export function LiveNews({ serverNow }: { serverNow: string }) {
  const router = useRouter();
  const [lastLoaded, setLastLoaded] = useState(() => new Date(serverNow));
  const [newCount, setNewCount] = useState(0);
  const [, forceTick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/news/updates?since=${encodeURIComponent(lastLoaded.toISOString())}`);
        if (res.ok) {
          const data = (await res.json()) as { count: number };
          setNewCount(data.count);
        }
      } catch {
        // sin red: se reintenta en el siguiente ciclo
      }
      forceTick((t) => t + 1); // refresca el "hace X minutos"
    }
    timer.current = setInterval(poll, POLL_MS);
    return () => {
      if (timer.current != null) clearInterval(timer.current);
    };
  }, [lastLoaded]);

  function loadNew() {
    setNewCount(0);
    setLastLoaded(new Date());
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
      <span className="text-pitch-muted">Actualizado {timeAgo(lastLoaded)}</span>
      {newCount > 0 && (
        <button
          type="button"
          onClick={loadNew}
          className="rounded-lg bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-pitch-accent"
        >
          Hay {newCount} {newCount === 1 ? 'noticia nueva' : 'noticias nuevas'} — ver
        </button>
      )}
    </div>
  );
}
