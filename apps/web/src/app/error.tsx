'use client';

import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Unhandled CornerMaximo route error', error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto max-w-2xl py-10 sm:py-16">
      <div className="fs-panel overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-grad-brand opacity-70"
        />
        <p className="fs-eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-pitch-danger" />
          Error inesperado
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">No hemos podido cargar esta sección</h1>
        <p className="mt-3 text-sm leading-6 text-pitch-muted">
          Tus datos no se han eliminado. Puedes volver a intentarlo o regresar a la portada mientras
          revisamos el problema.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="fs-btn-primary">
            Volver a intentar
          </button>
          <a href="/" className="fs-btn-ghost">
            Ir a la portada
          </a>
        </div>
      </div>
    </section>
  );
}
