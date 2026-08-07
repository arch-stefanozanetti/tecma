import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

/**
 * Verifica che le rotte sensibili emettano 429 quando il rate limit per-route
 * (profilo `strict`) viene saturato. Per default i test integration girano con
 * `API_RATE_LIMIT_PROFILE=loose` (max=10000/min, di fatto disattivato): qui
 * forziamo `strict` PRIMA di `buildServer` cosi i limit factories valutano il
 * profilo all'init del server.
 */

const API_KEY = '1234567890123456';
const seedPassword = 'Password123!';
const userEmail = 'rate-limit-test@tecma.test';

const baseHeaders = {
  'x-api-key': API_KEY,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('rate limit per-route (strict profile)', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;
    process.env.API_RATE_LIMIT_PROFILE = 'strict';

    app = await buildServer();

    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);

    await users.insertOne({
      _id: new ObjectId(),
      email: userEmail,
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });
  }, 60_000);

  afterAll(async () => {
    delete process.env.API_RATE_LIMIT_PROFILE;
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 60_000);

  it('POST /v1/auth/login restituisce 429 dopo aver superato il bucket strict (5/min)', async () => {
    // Le prime 5 chiamate devono passare il rate limit (potranno comunque restituire
    // 401 perche le credenziali sono volutamente sbagliate). La sesta deve essere 429.
    const wrongCredentials = { email: userEmail, password: 'WrongPassword' };

    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: baseHeaders,
        payload: wrongCredentials,
      });
      codes.push(res.statusCode);
    }

    // Le prime 5 chiamate non sono 429 (potrebbero essere 401 o 200 a seconda del flusso)
    const firstFive = codes.slice(0, 5);
    expect(firstFive.every((c) => c !== 429)).toBe(true);

    // La sesta deve essere 429
    expect(codes[5]).toBe(429);
  }, 30_000);

  it('POST /v1/auth/forgot-password restituisce 429 dopo aver superato il bucket (3/min)', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        headers: baseHeaders,
        payload: { email: 'forgot-pw-rate@tecma.test' },
      });
      codes.push(res.statusCode);
    }

    const firstThree = codes.slice(0, 3);
    expect(firstThree.every((c) => c !== 429)).toBe(true);
    expect(codes[3]).toBe(429);
  }, 30_000);
});
