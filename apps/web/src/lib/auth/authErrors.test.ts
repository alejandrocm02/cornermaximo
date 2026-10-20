import { describe, expect, it, vi } from 'vitest';
import { authErrorMessage, GENERIC_AUTH_ERROR } from './authErrors';

describe('authErrorMessage', () => {
  it('traduce por código de Supabase', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Correo o contraseña incorrectos.',
    );
    expect(authErrorMessage({ code: 'same_password', message: 'x' })).toMatch(/distinta de la actual/);
  });

  it('traduce por mensaje cuando falta el código', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe('Correo o contraseña incorrectos.');
    expect(authErrorMessage(new Error('Email not confirmed'))).toMatch(/Confirma tu correo/);
    expect(authErrorMessage(new Error('Auth session missing!'))).toMatch(/sesión ha caducado/);
  });

  it('no muestra mensajes desconocidos en inglés', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(authErrorMessage(new Error('Something unexpected happened'))).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(new Error('boom'), 'Texto propio.')).toBe('Texto propio.');
    expect(warn).toHaveBeenCalled();
  });

  it('acepta valores que no son errores', () => {
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage('texto')).toBe(GENERIC_AUTH_ERROR);
  });
});
