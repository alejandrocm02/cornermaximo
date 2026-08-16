'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer as ArrayBuffer;
}

type State = 'loading' | 'signed-out' | 'unsupported' | 'disabled' | 'enabled' | 'blocked';

export function PushNotificationSettings() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (active) setState('unsupported');
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setState('signed-out');
        return;
      }

      if (Notification.permission === 'denied') {
        setState('blocked');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? 'enabled' : 'disabled');
    };

    void load().catch(() => {
      if (active) setState('disabled');
    });
    return () => {
      active = false;
    };
  }, []);

  async function enablePush() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setState('signed-out');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'disabled');
        return;
      }

      const { data: config, error: configError } = await supabase
        .from('push_public_config')
        .select('vapid_public_key')
        .eq('singleton', true)
        .single();
      if (configError || !config?.vapid_public_key) throw configError ?? new Error('Push no configurado.');

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(config.vapid_public_key),
        });
      }

      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
        throw new Error('El navegador no devolvió una suscripción push válida.');
      }

      const { error: subscriptionError } = await supabase.from('user_push_subscriptions').upsert(
        {
          user_id: authData.user.id,
          endpoint: serialized.endpoint,
          p256dh: serialized.keys.p256dh,
          auth: serialized.keys.auth,
          user_agent: navigator.userAgent.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' },
      );
      if (subscriptionError) throw subscriptionError;

      const { error: preferenceError } = await supabase.from('user_alert_preferences').upsert(
        { user_id: authData.user.id, push_enabled: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (preferenceError) throw preferenceError;

      setState('enabled');
      setMessage('Notificaciones activadas en este dispositivo.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();

      if (authData.user && subscription) {
        const { error } = await supabase
          .from('user_push_subscriptions')
          .delete()
          .eq('user_id', authData.user.id)
          .eq('endpoint', subscription.endpoint);
        if (error) throw error;
      }
      if (subscription) await subscription.unsubscribe();

      if (authData.user) {
        const { error } = await supabase.from('user_alert_preferences').upsert(
          { user_id: authData.user.id, push_enabled: false, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
      }

      setState('disabled');
      setMessage('Notificaciones desactivadas en este dispositivo.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron desactivar las notificaciones.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fs-panel p-5 sm:p-6" aria-labelledby="push-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="fs-eyebrow">Web Push · PWA</p>
          <h2 id="push-title" className="mt-1 font-display text-xl font-bold text-white">
            Notificaciones en este dispositivo
          </h2>
          <p className="mt-2 text-sm leading-6 text-pitch-muted">
            Recibe avisos de directos, resultados y próximos partidos aunque CornerMaximo no esté abierto. La suscripción queda vinculada a tu cuenta y a este navegador.
          </p>
        </div>

        {state === 'enabled' ? (
          <button type="button" disabled={busy} onClick={() => void disablePush()} className="fs-btn-ghost disabled:opacity-50">
            {busy ? 'Guardando…' : 'Desactivar push'}
          </button>
        ) : state === 'disabled' ? (
          <button type="button" disabled={busy} onClick={() => void enablePush()} className="fs-btn-primary disabled:opacity-50">
            {busy ? 'Activando…' : 'Activar notificaciones'}
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-pitch-border bg-pitch-bg/45 px-4 py-3 text-sm">
        {state === 'loading' && <p className="text-pitch-muted">Comprobando compatibilidad y suscripción…</p>}
        {state === 'enabled' && <p className="text-pitch-accent">● Push activo en este dispositivo.</p>}
        {state === 'disabled' && <p className="text-pitch-muted">Push disponible, pero todavía no está activado.</p>}
        {state === 'signed-out' && <p className="text-pitch-muted">Inicia sesión para vincular notificaciones a tu cuenta.</p>}
        {state === 'unsupported' && <p className="text-pitch-muted">Este navegador no ofrece Web Push. Puedes seguir usando el centro de alertas dentro de CornerMaximo.</p>}
        {state === 'blocked' && <p className="text-pitch-danger">Las notificaciones están bloqueadas en el navegador. Debes permitirlas desde los ajustes del sitio.</p>}
      </div>

      {message && <p className="mt-3 text-xs text-pitch-muted" role="status">{message}</p>}
      <p className="mt-4 text-xs leading-5 text-pitch-muted">
        En iPhone/iPad, Web Push funciona cuando CornerMaximo se instala en la pantalla de inicio como aplicación web.
      </p>
    </section>
  );
}
