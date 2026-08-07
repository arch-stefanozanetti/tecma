#!/usr/bin/env node
/**
 * Smoke post-build: avvia `dist/server.js` con Mongo in-memory e verifica health + login.
 * Richiede `pnpm build` nel package API e build dei workspace `@followup/*`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { MongoClient } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import {
  SMOKE_API_KEY,
  SMOKE_PASSWORD,
  SMOKE_USER_EMAIL,
  seedSmokeFixture,
} from '../tests/helpers/smokeFixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(apiRoot, 'dist', 'server.js');
const smokePort = 18_080;
const healthTimeoutMs = 60_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (port: number): Promise<void> => {
  const deadline = Date.now() + healthTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (!response.ok) {
        await sleep(500);
        continue;
      }
      const body = (await response.json()) as { data?: { status?: string } };
      if (body.data?.status === 'ok') {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await sleep(500);
  }
  throw new Error(`Health check timed out on port ${port}`);
};

const stopChild = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode != null) {
    return;
  }
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

const main = async (): Promise<void> => {
  if (!existsSync(serverEntry)) {
    console.error('[smoke-built-server] Missing dist/server.js — run build first.');
    process.exit(1);
  }

  const mongoContext = await startInMemoryMongo();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MONGO_URI: mongoContext.uri,
    MONGO_DB_NAME: 'test-zanetti',
    ALLOWED_WRITE_DB: 'test-zanetti',
    ENABLE_POC_TZ_WRITES: '1',
    AUTH_JWT_SECRET: 'super-secure-jwt-secret-with-at-least-32-chars',
    INTERNAL_API_KEY: SMOKE_API_KEY,
    PORT: String(smokePort),
    NODE_ENV: 'test',
    APP_ENV: 'dev-1',
    SKIP_DOTENV_LOCAL_FOR_TEST: '1',
  };

  const seedClient = new MongoClient(mongoContext.uri);
  await seedClient.connect();
  try {
    await seedSmokeFixture(seedClient.db('test-zanetti'));
  } finally {
    await seedClient.close();
  }

  const child = spawn(process.execPath, [serverEntry], {
    cwd: apiRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForHealth(smokePort);

    const loginResponse = await fetch(`http://127.0.0.1:${smokePort}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: SMOKE_USER_EMAIL, password: SMOKE_PASSWORD }),
    });
    if (!loginResponse.ok) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    const loginBody = (await loginResponse.json()) as { data?: { accessToken?: string } };
    if (typeof loginBody.data?.accessToken !== 'string' || loginBody.data.accessToken.length < 20) {
      throw new Error('Login response missing accessToken');
    }

    console.log('[smoke-built-server] OK: health + login on dist/server.js');
  } catch (error) {
    console.error('[smoke-built-server] FAILED:', error);
    process.exitCode = 1;
  } finally {
    await stopChild(child);
    await stopInMemoryMongo(mongoContext);
  }

  process.exit(process.exitCode ?? 0);
};

void main();
