'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// El marcador/estado global se actualiza cada 15 s mediante LiveScoreboardController.
// Aquí reservamos llamadas por partido para eventos y detalle, que son más costosas.
const LIVE_CORE_INTERVAL_MS = 60_000;
const WARMUP_CORE_INTERVAL_MS = 60_000;
const DETAIL_INTERVAL_MS = 180_000;
const WARMUP_BEFORE_MS = 2 * 60 * 60 * 1000;
const WARMUP_AFTER_MS = 4 * 60 * 60 * 1000;

const TERMINAL = new Set(['FINISHED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED']);

interface CoreSnapshot {
  status: string;
  elapsed: number | null;
  extra: number | null;
  terminal: boolean;
  refreshedAt: string;
}

export function LiveMatchTicker({
  matchId,
  initialStatus,
  kickoffAt,
}: {
  matchId: number;
  initialStatus: string;
  kickoffAt: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [extra, setExtra] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const finalDetailSent = useRef(false);

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  const inLiveWindow = useMemo(() => {
    if (status === 'LIVE') return true;
    if (TERMINAL.has(status)) return false;
    const kickoff = new Date(kickoffAt).getTime();
    if (!Number.isFinite(kickoff)) return false;
    const delta = Date.now() - kickoff;
    return delta >= -WARMUP_BEFORE_MS && delta <= WARMUP_AFTER_MS;
  }, [kickoffAt, status]);

  const refreshDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/matches/${matchId}/detail`);
      if (!response.ok) return;
      setConnected(true);
      router.refresh();
    } catch {
      setConnected(false);
    }
  }, [matchId, router]);

  const refreshCore = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/matches/${matchId}/core`);
      if (!response.ok) {
        setConnected(false);
        return;
      }
      const snapshot = (await response.json()) as CoreSnapshot;
      const becameTerminal = snapshot.terminal && !TERMINAL.has(status);
      setStatus(snapshot.status);
      setElapsed(snapshot.elapsed);
      setExtra(snapshot.extra);
      setLastUpdatedAt(snapshot.refreshedAt);
      setConnected(true);
      router.refresh();

      if (becameTerminal && !finalDetailSent.current) {
        finalDetailSent.current = true;
        await refreshDetail();
      }
    } catch {
      setConnected(false);
    }
  }, [matchId, refreshDetail, router, status]);

  useEffect(() => {
    if (!inLiveWindow || TERMINAL.has(status)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      if (!document.hidden) await refreshCore();
      if (cancelled) return;
      const delay = status === 'LIVE' ? LIVE_CORE_INTERVAL_MS : WARMUP_CORE_INTERVAL_MS;
      timer = setTimeout(loop, document.hidden ? Math.max(delay, 120_000) : delay);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [inLiveWindow, refreshCore, status]);

  useEffect(() => {
    if (!inLiveWindow || TERMINAL.has(status)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      if (!document.hidden) await refreshDetail();
      if (cancelled) return;
      timer = setTimeout(loop, document.hidden ? 300_000 : DETAIL_INTERVAL_MS);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [inLiveWindow, refreshDetail, status]);

  if (status !== 'LIVE') return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-pitch-danger/30 bg-pitch-danger/10 px-2 py-1 font-semibold text-pitch-danger"
      title={lastUpdatedAt != null ? `Última actualización ${new Date(lastUpdatedAt).toLocaleTimeString('es-ES')}` : undefined}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full bg-pitch-danger ${connected ? 'animate-pulse' : 'opacity-50'}`} />
      {elapsed != null ? `${elapsed}'${extra != null && extra > 0 ? `+${extra}` : ''}` : 'EN DIRECTO'}
    </span>
  );
}
