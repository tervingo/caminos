import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('configuración', () => {
  it('trata las variables vacías como no definidas', () => {
    const config = loadConfig({ PUBLIC_ASSETS_URL: '', ALLOWED_ORIGIN: '', PORT: '', DATABASE_URL: '' });
    expect(config.PUBLIC_ASSETS_URL).toBe('https://encaminos.netlify.app');
    expect(config.origenesPermitidos).toEqual(['http://localhost:5173', 'https://encaminos.netlify.app']);
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it('exige un JWT_SECRET largo en producción', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
    expect(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET).toHaveLength(32);
  });
});
