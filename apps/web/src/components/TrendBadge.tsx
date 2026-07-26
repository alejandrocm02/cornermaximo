/**
 * Indicador de tendencia.
 * La dirección se comunica con símbolo + texto además del color, para no
 * depender únicamente de la percepción cromática (WCAG 1.4.1).
 */
const LABELS: Record<string, { text: string; cls: string }> = {
  UP: {
    text: '▲ En aumento',
    cls: 'border-pitch-accent/30 bg-pitch-accent/10 text-pitch-accent',
  },
  STABLE: {
    text: '▪ Estable',
    cls: 'border-pitch-border-strong bg-pitch-elevated text-pitch-subtle',
  },
  DOWN: {
    text: '▼ En descenso',
    cls: 'border-pitch-danger/30 bg-pitch-danger/10 text-pitch-danger',
  },
  INSUFFICIENT_SAMPLE: {
    text: 'Muestra insuficiente',
    cls: 'border-pitch-border bg-pitch-card text-pitch-muted',
  },
};

export function TrendBadge({ direction, label }: { direction: string; label: string }) {
  const info = LABELS[direction] ?? LABELS.INSUFFICIENT_SAMPLE!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-semibold ${info.cls}`}
    >
      <span className="text-pitch-muted">{label}</span>
      <span aria-hidden="true" className="opacity-40">
        |
      </span>
      {info.text}
    </span>
  );
}
