'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const CONFIRMATION = 'ELIMINAR';

export function AccountDataControls() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/account/export', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo generar la exportación.');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'cornermaximo-datos.json';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('Exportación preparada correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar la exportación.');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmation !== CONFIRMATION) return;
    setDeleting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: CONFIRMATION },
      });
      if (error) throw error;

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // La cuenta ya puede no existir; el objetivo aquí es limpiar la sesión local.
      }

      try {
        localStorage.removeItem('cornermaximo.favorites.v1');
        localStorage.removeItem('cornermaximo.analizador.v1');
        localStorage.removeItem('cornermaximo.comparisons.v1');
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (
            key?.startsWith('cornermaximo.favorites.account-migrated.v1:') ||
            key?.includes('.account-owner') ||
            key?.includes('.account-dirty')
          ) localStorage.removeItem(key);
        }
        sessionStorage.clear();
      } catch {
        // El almacenamiento puede estar bloqueado por el navegador.
      }

      router.replace('/?cuenta=eliminada');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.');
      setDeleting(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <section className="rounded-xl border border-pitch-border bg-pitch-bg/45 p-5">
        <h2 className="font-display text-xl font-bold text-white">Tus datos</h2>
        <p className="mt-2 text-sm leading-6 text-pitch-muted">
          Descarga en JSON los datos personales que CornerMaximo conserva en el servidor: cuenta, favoritos, watchlists, alertas, comparaciones y estado del Analizador.
        </p>
        <button type="button" onClick={exportData} disabled={exporting} className="fs-btn-ghost mt-4 justify-center disabled:opacity-50">
          {exporting ? 'Preparando exportación…' : 'Descargar mis datos'}
        </button>
      </section>

      <section className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/5 p-5">
        <h2 className="font-display text-xl font-bold text-white">Eliminar cuenta</h2>
        <p className="mt-2 text-sm leading-6 text-pitch-muted">
          Esta acción elimina tu usuario de Supabase Auth y los datos personales vinculados a la cuenta mediante borrado en cascada. No elimina datos deportivos públicos de CornerMaximo.
        </p>
        <p className="mt-3 text-sm font-semibold text-pitch-danger">
          Es irreversible. Descarga antes una copia si quieres conservar tus datos.
        </p>
        <label className="mt-4 block text-sm text-pitch-subtle">
          Escribe <strong className="text-white">{CONFIRMATION}</strong> para confirmar
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2 text-white outline-none focus:border-pitch-danger"
          />
        </label>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={confirmation !== CONFIRMATION || deleting}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-pitch-danger/60 bg-pitch-danger/10 px-4 py-2 text-sm font-semibold text-pitch-danger transition hover:bg-pitch-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? 'Eliminando cuenta…' : 'Eliminar mi cuenta definitivamente'}
        </button>
      </section>

      {message != null && <p role="status" className="text-sm text-pitch-subtle">{message}</p>}
    </div>
  );
}
