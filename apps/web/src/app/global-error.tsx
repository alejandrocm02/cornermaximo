'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Unhandled CornerMaximo root error', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-pitch-bg font-sans text-slate-100 antialiased">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12 sm:px-6">
          <section role="alert" className="fs-panel w-full overflow-hidden p-6 sm:p-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-grad-brand opacity-70"
            />
            <p className="fs-eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-pitch-danger" />
              CornerMaximo no está disponible
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Se ha producido un error general</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-pitch-muted">
              No hemos podido iniciar correctamente la aplicación. Vuelve a intentarlo; si el fallo
              continúa, regresa a la portada para iniciar una navegación nueva.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="fs-btn-primary">
                Reiniciar CornerMaximo
              </button>
              <a href="/" className="fs-btn-ghost">
                Recargar la portada
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
