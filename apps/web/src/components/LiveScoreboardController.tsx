'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const INTERVAL_MS = 15_000;

export function LiveScoreboardController() {
  const router = useRouter();
  const pathname = usePathname();
  const isMatchDetail = /^\/partidos\/\d+$/.test(pathname);

  useEffect(() => {
    if (isMatchDetail) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      try {
        if (!document.hidden) {
          const response = await fetch('/api/live/scoreboard', { cache: 'no-store' });
          if (response.ok) router.refresh();
        }
      } catch {
        // El marcador conserva el último estado conocido si el proveedor falla.
      }
      if (cancelled) return;
      timer = setTimeout(loop, document.hidden ? 45_000 : INTERVAL_MS);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [isMatchDetail, router]);

  return null;
}
