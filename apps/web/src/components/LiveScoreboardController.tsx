'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 25% fewer recurring requests than the previous polling cadence.
const LIVE_INTERVAL_MS = 20_000;
const IDLE_INTERVAL_MS = 80_000;
const HIDDEN_INTERVAL_MS = 120_000;

interface ScoreboardSnapshot {
  live: number;
  changed?: number;
  refreshedAt?: string;
}

export function LiveScoreboardController() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastApplied: string | null = null;
    let lastLive: number | null = null;

    const loop = async () => {
      if (cancelled) return;
      let delay = IDLE_INTERVAL_MS;
      try {
        if (!document.hidden) {
          const response = await fetch('/api/live/scoreboard');
          if (response.ok) {
            const snapshot = (await response.json()) as ScoreboardSnapshot;
            delay = snapshot.live > 0 ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
            // Solo se vuelve a renderizar en servidor si hubo cambios: antes se
            // hacía en cada sondeo (cada 80 s en /partidos aunque no hubiera
            // directos), con una invocación de función completa cada vez.
            const isNewResult = snapshot.refreshedAt == null || snapshot.refreshedAt !== lastApplied;
            const hasChanges = (snapshot.changed ?? 1) > 0 || (lastLive != null && snapshot.live !== lastLive);
            if (isNewResult && hasChanges) {
              lastApplied = snapshot.refreshedAt ?? null;
              router.refresh();
            }
            lastLive = snapshot.live;
          }
        } else {
          delay = HIDDEN_INTERVAL_MS;
        }
      } catch {
        // Conserva el último estado conocido y reduce presión sobre el proveedor.
        delay = IDLE_INTERVAL_MS;
      }
      if (cancelled) return;
      timer = setTimeout(loop, delay);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [router]);

  return null;
}
