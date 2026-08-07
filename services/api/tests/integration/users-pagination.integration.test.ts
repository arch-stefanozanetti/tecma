import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

/**
 * Verifica la paginazione reale (page/perPage/sortField/sortOrder) su
 * GET /v1/users — pilot di Wave D del piano PR40 cross-domain.
 */

const API_KEY = '1234567890123456';
const seedPassword = 'Password123!';
const adminEmail = 'pagination-admin@tecma.test';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let adminToken: string;

const authHeaders = () => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${adminToken}`,
  'content-type': 'application/json',
});

describe('GET /v1/users — real pagination (Wave D pilot)', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();

    const usersCollection = app.mongoDb.collection('tz_users');
    const hash = await bcrypt.hash(seedPassword, 10);
    const now = new Date();

    // 1 admin + 25 utenti seed (per testare almeno 2 pagine da 20)
    await usersCollection.insertOne({
      _id: new ObjectId(),
      email: adminEmail,
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const seedDocs = Array.from({ length: 25 }).map((_, i) => ({
      _id: new ObjectId(),
      email: `seed-user-${String(i).padStart(2, '0')}@tecma.test`,
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      // Tempi crescenti cosi sortOrder=desc su createdAt mette i piu recenti per primi.
      createdAt: new Date(now.getTime() + i * 1000).toISOString(),
      updatedAt: new Date(now.getTime() + i * 1000).toISOString(),
    }));
    await usersCollection.insertMany(seedDocs);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: adminEmail, password: seedPassword },
    });
    expect(login.statusCode).toBe(200);
    adminToken = login.json().data.accessToken as string;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 60_000);

  it('default: page=1 perPage=20 — restituisce 20 doc su 26 totali', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: unknown[];
      paginationInfo: {
        page: number;
        perPage: number;
        totalDocs: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
        nextPage: number | null;
        prevPage: number | null;
      };
    };
    expect(body.paginationInfo.page).toBe(1);
    expect(body.paginationInfo.perPage).toBe(20);
    expect(body.paginationInfo.totalDocs).toBe(26);
    expect(body.paginationInfo.totalPages).toBe(2);
    expect(body.paginationInfo.hasNextPage).toBe(true);
    expect(body.paginationInfo.hasPrevPage).toBe(false);
    expect(body.paginationInfo.nextPage).toBe(2);
    expect(body.paginationInfo.prevPage).toBeNull();
    expect(body.data.length).toBe(20);
  });

  it('page=2: restituisce gli ultimi 6 doc + paginationInfo coerente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?page=2',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: unknown[];
      paginationInfo: { page: number; hasNextPage: boolean; hasPrevPage: boolean };
    };
    expect(body.data.length).toBe(6);
    expect(body.paginationInfo.page).toBe(2);
    expect(body.paginationInfo.hasNextPage).toBe(false);
    expect(body.paginationInfo.hasPrevPage).toBe(true);
  });

  it('perPage custom: rispetta il valore richiesto', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?perPage=5',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: unknown[];
      paginationInfo: { perPage: number; totalPages: number };
    };
    expect(body.data.length).toBe(5);
    expect(body.paginationInfo.perPage).toBe(5);
    expect(body.paginationInfo.totalPages).toBe(6); // 26 / 5 = 5.2 -> 6
  });

  it('boundary: page=0 -> 400 (validation)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?page=0',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('boundary: perPage=200 -> 400 (oltre il limite max=100)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?perPage=200',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('boundary: sortField non whitelistato -> 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?sortField=passwordHash',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('sortField=email + sortOrder=asc: dati ordinati alfabeticamente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?sortField=email&sortOrder=asc&perPage=5',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { email: string }[] };
    const emails = body.data.map((d) => d.email);
    const sorted = [...emails].sort();
    expect(emails).toEqual(sorted);
  });
});
