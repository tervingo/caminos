import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('prueba de cookie', () => {
  it('pone una cookie httpOnly y la lee después', async () => {
    const app = buildApp(loadConfig({ NODE_ENV: 'production' }));

    const puesta = await app.inject({ method: 'POST', url: '/api/prueba/cookie' });
    const cookie = puesta.cookies.find((c) => c.name === 'prueba_cookie');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });

    const leida = await app.inject({
      method: 'GET',
      url: '/api/prueba/cookie',
      cookies: { prueba_cookie: cookie!.value },
    });
    expect(leida.json()).toEqual({ recibida: true, valor: cookie!.value });

    const sin = await app.inject({ method: 'GET', url: '/api/prueba/cookie' });
    expect(sin.json()).toEqual({ recibida: false, valor: null });

    await app.close();
  });
});
