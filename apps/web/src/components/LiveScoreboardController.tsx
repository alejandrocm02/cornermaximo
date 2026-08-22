'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const LIVE_INTERVAL_MS = 15_000;
const IDLE_INTERVAL_MS = 60_000;
const HIDDEN_INTERVAL_MS = 120_000;

interface ScoreboardSnapshot {
  live: number;
}

export function LiveScoreboardController() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      let delay = IDLE_INTERVAL_MS;
      try {
        if (!document.hidden) {
          const response = await fetch('/api/live/scoreboard');
          if (response.ok) {
            const snapshot = (await response.json()) as ScoreboardSnapshot;
            delay = snapshot.live > 0 ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
            router.refresh();
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
