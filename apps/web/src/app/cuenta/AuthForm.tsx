'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { AuthFormState } from './actions';

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export function AuthForm({
  mode,
  action,
}: {
  mode: 'login' | 'register';
  action: AuthAction;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const registering = mode === 'register';

  return (
    <form action={formAction} className="fs-panel mx-auto grid max-w-md gap-5 p-5 sm:p-7">
      <div>
        <p className="fs-eyebrow">Cuenta FutStats</p>
        <h1 className="mt-2 text-3xl font-bold">{registering ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p className="mt-2 text-sm leading-6 text-pitch-muted">
          {registering
            ? 'Guarda tus preferencias y prepara la sincronización entre dispositivos.'
            : 'Accede a tu espacio personal de FutStats.'}
        </p>
      </div>

      {state.error != null && (
        <div role="alert" className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">
          {state.error}
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-medium text-pitch-subtle">
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.fields?.email ?? ''}
          className="fs-input"
          placeholder="tu@correo.com"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-pitch-subtle">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          required
          minLength={registering ? 10 : 1}
          maxLength={128}
          className="fs-input"
        />
        {registering && (
          <span className="text-xs font-normal text-pitch-muted">
            Mínimo 10 caracteres, con mayúscula, minúscula y número.
          </span>
        )}
      </label>

      {registering && (
        <label className="grid gap-1.5 text-sm font-medium text-pitch-subtle">
          Repetir contraseña
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            className="fs-input"
          />
        </label>
      )}

      <button type="submit" disabled={pending} className="fs-btn-primary h-11 disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Procesando…' : registering ? 'Crear cuenta' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-pitch-muted">
        {registering ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'}{' '}
        <Link href={registering ? '/cuenta/acceso' : '/cuenta/registro'} className="font-semibold text-pitch-accent hover:underline">
          {registering ? 'Inicia sesión' : 'Regístrate'}
        </Link>
      </p>
    </form>
  );
}
