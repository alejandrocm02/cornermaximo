'use client';
export default function Error({reset}:{reset:()=>void}){return <div className="fs-panel p-6"><h2 className="font-display text-lg font-bold">No se pudo mostrar esta vista</h2><button onClick={reset} className="fs-btn-primary mt-4">Reintentar</button></div>}
