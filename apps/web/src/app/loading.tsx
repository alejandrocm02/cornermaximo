export default function Loading() {
  return (
    <section aria-busy="true" aria-labelledby="loading-title" className="space-y-6">
      <h1 id="loading-title" className="sr-only">
        Cargando contenido
      </h1>

      <div aria-hidden="true" className="space-y-3">
        <div className="fs-skeleton h-3 w-28" />
        <div className="fs-skeleton h-10 max-w-xl" />
        <div className="fs-skeleton h-4 max-w-2xl" />
      </div>

      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="fs-panel space-y-3 p-5">
            <div className="fs-skeleton h-3 w-20" />
            <div className="fs-skeleton h-8 w-24" />
            <div className="fs-skeleton h-3 w-32" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="fs-panel space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="fs-skeleton h-6 w-44" />
          <div className="fs-skeleton h-8 w-24 rounded-full" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-pitch-border/60 pt-4">
            <div className="space-y-2">
              <div className="fs-skeleton h-4 max-w-md" />
              <div className="fs-skeleton h-3 max-w-xs" />
            </div>
            <div className="fs-skeleton h-7 w-14" />
          </div>
        ))}
      </div>
    </section>
  );
}
