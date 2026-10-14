import { describe, expect, it } from 'vitest';
import { healthSchema } from '@caminos/shared';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const app = buildApp(loadConfig({ NODE_ENV: 'test' }));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthSchema.parse(res.json())).toMatchObject({ status: 'ok', db: 'sin-configurar' });
    await app.close();
  });
});
