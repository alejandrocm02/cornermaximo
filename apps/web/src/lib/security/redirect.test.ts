import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './redirect';

describe('safeInternalPath', () => {
  it('accepts same-origin relative paths', () => {
    expect(safeInternalPath('/cuenta?tab=seguridad#sesion', '/cuenta')).toBe('/cuenta?tab=seguridad#sesion');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeInternalPath('https://evil.example', '/cuenta')).toBe('/cuenta');
    expect(safeInternalPath('//evil.example/phishing', '/cuenta')).toBe('/cuenta');
  });

  it('rejects backslash variants that URL parsing treats as another origin', () => {
    expect(safeInternalPath('/\\evil.example/phishing', '/cuenta')).toBe('/cuenta');
  });
});
