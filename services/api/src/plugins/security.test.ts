import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Fastify from 'fastify';
import type { AppConfig } from '@followup/shared-config';

import { securityPlugin } from './security.js';

const mkConfig = (
  partial: Partial<AppConfig> & Pick<AppConfig, 'NODE_ENV' | 'corsOrigins'>,
): AppConfig => partial as AppConfig;

async function withSecurityApp(config: AppConfig) {
  const app = Fastify({ logger: false });
  app.decorate('config', config);
  await app.register(securityPlugin);
  app.get('/v1/health', async () => ({ data: { ok: true } }));
  await app.ready();
  return app;
}

describe('securityPlugin', () => {
  beforeEach(() => {
    delete process.env.API_DISABLE_RATE_LIMIT;
  });

  afterEach(() => {
    delete process.env.API_DISABLE_RATE_LIMIT;
  });

  it('imposta Permissions-Policy e Cache-Control no-store quando c’è Authorization', async () => {
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'test',
        corsOrigins: ['https://app.example'],
      }),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { authorization: 'Bearer x.y.z' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['permissions-policy']).toMatch(/camera=\(\)/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    await app.close();
  });

  it('non forza no-store senza header di autenticazione', async () => {
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'test',
        corsOrigins: ['https://app.example'],
      }),
    );
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control'] ?? '').not.toMatch(/no-store/);
    await app.close();
  });

  it('in test accetta Origin localhost http per CORS', async () => {
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'test',
        corsOrigins: [],
      }),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    await app.close();
  });

  it('in production rifiuta origine non in allowlist (CORS)', async () => {
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'production',
        corsOrigins: ['https://allowed-only.example'],
      }),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(500);
    await app.close();
  });

  it('in production accetta origine in corsOrigins', async () => {
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'production',
        corsOrigins: ['https://allowed-only.example'],
      }),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'https://allowed-only.example' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed-only.example');
    await app.close();
  });

  it('applica rate limit globale in production (429 dopo soglia)', async () => {
    process.env.API_DISABLE_RATE_LIMIT = undefined;
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'production',
        corsOrigins: ['https://allowed-only.example'],
        API_RATE_LIMIT_MAX: 2,
      }),
    );

    const ok1 = await app.inject({ method: 'GET', url: '/v1/health' });
    const ok2 = await app.inject({ method: 'GET', url: '/v1/health' });
    const limited = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(ok1.statusCode).toBe(200);
    expect(ok2.statusCode).toBe(200);
    expect(limited.statusCode).toBe(429);
    await app.close();
  });

  it('salta rate limit globale quando API_DISABLE_RATE_LIMIT=true', async () => {
    process.env.API_DISABLE_RATE_LIMIT = 'true';
    const app = await withSecurityApp(
      mkConfig({
        NODE_ENV: 'production',
        corsOrigins: ['https://allowed-only.example'],
        API_RATE_LIMIT_MAX: 1,
      }),
    );

    const a = await app.inject({ method: 'GET', url: '/v1/health' });
    const b = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    await app.close();
  });
});
