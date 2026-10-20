import { describe, expect, it } from 'vitest';
import { authLinkTarget, isRecoverySession, linkErrorReason, parseEmailOtpType } from './authLinks';

const at = (path: string) => new URL(path, 'https://cornermaximo.es');

describe('authLinkTarget', () => {
  it('reconduce a /auth/callback un código PKCE que llega a la portada', () => {
    expect(authLinkTarget(at('/?code=abc-123'))).toBe('/auth/callback?code=abc-123');
  });

  it('reconduce a /auth/confirm un token_hash que llega a la portada', () => {
    expect(authLinkTarget(at('/?token_hash=xyz&type=recovery'))).toBe('/auth/confirm?token_hash=xyz&type=recovery');
  });

  it('manda un enlace caducado a pedir otro', () => {
    expect(authLinkTarget(at('/?error=access_denied&error_code=otp_expired&error_description=x'))).toBe(
      '/auth/forgot-password?error=expired',
    );
  });

  it('no toca otras rutas ni la portada normal', () => {
    expect(authLinkTarget(at('/'))).toBeNull();
    expect(authLinkTarget(at('/?temporada=2026'))).toBeNull();
    expect(authLinkTarget(at('/comparador?code=messi'))).toBeNull();
  });
});

describe('isRecoverySession', () => {
  it('reconoce la recuperación en el claim amr, en sus dos formatos', () => {
    expect(isRecoverySession([{ method: 'recovery', timestamp: 1 }])).toBe(true);
    expect(isRecoverySession(['recovery'])).toBe(true);
    expect(isRecoverySession([{ method: 'password', timestamp: 1 }])).toBe(false);
    expect(isRecoverySession(undefined)).toBe(false);
  });
});

describe('linkErrorReason y parseEmailOtpType', () => {
  it('distingue un enlace caducado de uno inválido', () => {
    expect(linkErrorReason('otp_expired')).toBe('expired');
    expect(linkErrorReason('bad_code_verifier')).toBe('invalid');
    expect(linkErrorReason(null)).toBe('invalid');
  });

  it('solo acepta tipos de enlace de correo conocidos', () => {
    expect(parseEmailOtpType('recovery')).toBe('recovery');
    expect(parseEmailOtpType('signup')).toBe('signup');
    expect(parseEmailOtpType('admin')).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});
