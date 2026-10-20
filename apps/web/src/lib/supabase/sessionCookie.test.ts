import { describe, expect, it } from 'vitest';
import { isSupabaseAuthCookie, isSupabaseSessionCookie } from './sessionCookie';

describe('isSupabaseSessionCookie', () => {
  it('reconoce la sesión entera y troceada', () => {
    expect(isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token')).toBe(true);
    expect(isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token.0')).toBe(true);
    expect(isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token.12')).toBe(true);
  });

  it('no confunde los verificadores PKCE con una sesión', () => {
    expect(isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token-code-verifier')).toBe(false);
    expect(isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token-flows-code-verifier')).toBe(false);
    expect(
      isSupabaseSessionCookie('sb-wkyqinuzeuppdjqazdsl-auth-token-flow-6b4e7979860660294998efc2594e0786-code-verifier'),
    ).toBe(false);
  });

  it('ignora otras cookies', () => {
    expect(isSupabaseSessionCookie('cornermaximo.consent')).toBe(false);
    expect(isSupabaseSessionCookie('sb-auth-token')).toBe(false);
  });
});

describe('isSupabaseAuthCookie', () => {
  it('incluye los verificadores, para poder limpiarlos', () => {
    expect(isSupabaseAuthCookie('sb-x-auth-token-code-verifier')).toBe(true);
    expect(isSupabaseAuthCookie('sb-x-auth-token')).toBe(true);
    expect(isSupabaseAuthCookie('_ga')).toBe(false);
  });
});
