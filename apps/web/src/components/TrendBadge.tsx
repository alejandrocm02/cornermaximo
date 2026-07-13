const LABELS: Record<string, { text: string; cls: string }> = {
  UP: { text: '▲ En aumento', cls: 'bg-pitch-accent/15 text-pitch-accent' },
  STABLE: { text: '▪ Estable', cls: 'bg-slate-500/15 text-slate-300' },
  DOWN: { text: '▼ En descenso', cls: 'bg-pitch-danger/15 text-pitch-danger' },
  INSUFFICIENT_SAMPLE: { text: 'Muestra insuficiente', cls: 'bg-slate-600/15 text-pitch-muted' },
};

export function TrendBadge({ direction, label }: { direction: string; label: string }) {
  const info = LABELS[direction] ?? LABELS.INSUFFICIENT_SAMPLE!;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${info.cls}`}>
      {label}: {info.text}
    </span>
  );
}
