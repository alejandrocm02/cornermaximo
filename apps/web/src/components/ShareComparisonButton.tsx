'use client';

import { useState } from 'react';

export function ShareComparisonButton({ p1, p2 }: { p1: string; p2: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const imageUrl = `/api/comparison-card?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`;

  async function share() {
    setMessage(null);
    const comparisonUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Comparación CornerMaximo', text: 'Mira esta comparación en CornerMaximo', url: comparisonUrl });
        return;
      }
      await navigator.clipboard.writeText(comparisonUrl);
      setMessage('Enlace copiado.');
    } catch {
      setMessage('No se pudo abrir el menú para compartir.');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="fs-btn-primary inline-flex">
        Abrir imagen compartible
      </a>
      <button type="button" onClick={() => void share()} className="fs-btn-ghost">
        Compartir comparación
      </button>
      <a href={imageUrl} download={`cornermaximo-${p1}-vs-${p2}.png`} className="fs-btn-ghost inline-flex">
        Guardar PNG
      </a>
      {message && <span className="text-xs text-pitch-muted" role="status">{message}</span>}
    </div>
  );
}
