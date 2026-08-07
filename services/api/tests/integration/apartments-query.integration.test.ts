import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('POST /v1/apartments/query integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-apartments';
    process.env.ALLOWED_WRITE_DB = 'test-apartments';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const userId = new ObjectId();

    await app.mongoDb.collection('tz_users').insertOne({
      _id: userId,
      email: 'apartments-user@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: 'ws-apt-test',
      name: 'Workspace Apt',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      workspaceId: 'ws-apt-test',
      userId: userId.toHexString(),
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await app.mongoDb.collection('tz_projects').insertMany([
      {
        _id: 'p-apt-1',
        workspaceId: 'ws-apt-test',
        name: 'Project Apt 1',
        code: 'APT-1',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'p-apt-2',
        workspaceId: 'ws-apt-test',
        name: 'Project Apt 2',
        code: 'APT-2',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_apartments').insertMany([
      {
        _id: new ObjectId(),
        workspaceId: 'ws-apt-test',
        projectId: 'p-apt-1',
        code: 'U-101',
        name: 'Unit 101',
        status: 'AVAILABLE',
        mode: 'SELL',
        price: 320000,
        surfaceMq: 82,
        floor: 2,
        deposit: 10000,
        tags: ['garden', 'premium'],
        planimetryAssetId: new ObjectId().toHexString(),
        plan: { rooms: 3, typology: { name: 'Trilocale' } },
        building: { name: 'Palazzina A' },
        extraInfo: { galleryUrls: ['https://cdn.example.test/a.jpg'] },
        updatedAt: now,
        createdAt: now,
      },
      {
        _id: new ObjectId(),
        workspaceId: 'ws-apt-test',
        projectId: 'p-apt-2',
        code: 'U-202',
        name: 'Unit 202',
        status: 'RESERVED',
        mode: 'RENT',
        price: 1800,
        surfaceMq: 48,
        floor: 5,
        tags: ['city'],
        plan: { rooms: 1, typology: { name: 'Monolocale' } },
        building: { name: 'Palazzina B' },
        updatedAt: now,
        createdAt: now,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 120_000);

  it('returns apartments for workspace and selected projects', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'apartments-user@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/apartments/query',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        projectIds: ['p-apt-1'],
        page: 1,
        perPage: 25,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ code: string }>;
      paginationInfo: { totalDocs: number };
    };
    expect(body.paginationInfo.totalDocs).toBe(1);
    expect(body.data.some((row) => row.code === 'U-101')).toBe(true);
  });

  it('filters apartments by advanced POC-derived fields', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'apartments-user@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/apartments/query',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        projectIds: ['p-apt-1', 'p-apt-2'],
        filters: {
          priceMin: 300000,
          priceMax: 350000,
          surfaceMin: 75,
          surfaceMax: 90,
          floorMin: 1,
          floorMax: 3,
          tags: ['premium'],
          typology: 'trilocale',
          buildingName: 'Palazzina A',
          roomsMin: 3,
          hasPlanimetry: true,
          hasGallery: true,
          hasAdvancedData: true,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ code: string }> };
    expect(body.data.map((row) => row.code)).toEqual(['U-101']);
  });

  it('rejects missing workspace membership', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'apartments-user@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/apartments/query',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-other',
        projectIds: ['p-apt-1'],
        page: 1,
        perPage: 10,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('creates, reads and patches an apartment inside an active workspace project', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'apartments-user@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;
    const floorPlanAssetId = new ObjectId();
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_assets').insertOne({
      _id: floorPlanAssetId,
      workspaceId: 'ws-apt-test',
      projectId: 'p-apt-1',
      kind: 'apartment.floorplan',
      fileName: 'floor.png',
      contentType: 'image/png',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const create = await app.inject({
      method: 'POST',
      url: '/v1/apartments',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        projectId: 'p-apt-1',
        name: 'Unit 303',
        code: 'U-303',
        mode: 'SELL',
        status: 'AVAILABLE',
        price: 350000,
        surfaceMq: 72,
        planimetryAssetId: floorPlanAssetId.toHexString(),
        tags: ['garden'],
        plan: { typology: { name: 'Trilocale' } },
      },
    });

    expect(create.statusCode).toBe(201);
    const created = create.json() as {
      data: { _id: string; code: string; price: number; planimetryAssetId: string };
    };
    expect(created.data.code).toBe('U-303');
    expect(created.data.price).toBe(350000);
    expect(created.data.planimetryAssetId).toBe(floorPlanAssetId.toHexString());

    const read = await app.inject({
      method: 'GET',
      url: `/v1/apartments/${created.data._id}?workspaceId=ws-apt-test`,
      headers: authHeaders(token),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().data.name).toBe('Unit 303');

    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/apartments/${created.data._id}`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        name: 'Unit 303 Premium',
        status: 'RESERVED',
        planimetryAssetId: '',
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.name).toBe('Unit 303 Premium');
    expect(patch.json().data.status).toBe('RESERVED');
    expect(patch.json().data.planimetryAssetId).toBe('');

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'apartments.update',
      workspaceId: 'ws-apt-test',
    });
    expect(audit).not.toBeNull();
  });

  it('manages prices, monthly rents, inventory and calendar for an apartment', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'apartments-user@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const create = await app.inject({
      method: 'POST',
      url: '/v1/apartments',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        projectId: 'p-apt-1',
        name: 'Unit Pricing',
        code: 'U-PRICE',
        mode: 'SELL',
        status: 'AVAILABLE',
        price: 250000,
      },
    });
    expect(create.statusCode).toBe(201);
    const apartmentId = create.json().data._id as string;

    const emptyPrices = await app.inject({
      method: 'GET',
      url: `/v1/apartments/${apartmentId}/prices?workspaceId=ws-apt-test`,
      headers: authHeaders(token),
    });
    expect(emptyPrices.statusCode).toBe(200);
    expect(emptyPrices.json().data.current.value).toBe(250000);
    expect(emptyPrices.json().data.salePrices).toEqual([]);
    expect(emptyPrices.json().data.monthlyRents).toEqual([]);

    const sale = await app.inject({
      method: 'POST',
      url: `/v1/apartments/${apartmentId}/prices/sale`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        price: 275000,
        validFrom: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(sale.statusCode).toBe(201);
    expect(sale.json().data.price).toBe(275000);

    const salePatch = await app.inject({
      method: 'PATCH',
      url: `/v1/apartments/${apartmentId}/prices/sale/${sale.json().data._id}`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        price: 280000,
      },
    });
    expect(salePatch.statusCode).toBe(200);
    expect(salePatch.json().data.price).toBe(280000);

    const rent = await app.inject({
      method: 'POST',
      url: `/v1/apartments/${apartmentId}/prices/monthly-rent`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        pricePerMonth: 1400,
        deposit: 2800,
        validFrom: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(rent.statusCode).toBe(201);
    expect(rent.json().data.pricePerMonth).toBe(1400);

    const rentPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/apartments/${apartmentId}/prices/monthly-rent/${rent.json().data._id}`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        deposit: 3000,
      },
    });
    expect(rentPatch.statusCode).toBe(200);
    expect(rentPatch.json().data.deposit).toBe(3000);

    const inventory = await app.inject({
      method: 'PATCH',
      url: `/v1/apartments/${apartmentId}/inventory`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        inventoryStatus: 'reserved',
        requestId: 'request-1',
      },
    });
    expect(inventory.statusCode).toBe(200);
    expect(inventory.json().data.inventoryStatus).toBe('reserved');

    const readInventory = await app.inject({
      method: 'GET',
      url: `/v1/apartments/${apartmentId}/inventory?workspaceId=ws-apt-test`,
      headers: authHeaders(token),
    });
    expect(readInventory.statusCode).toBe(200);
    expect(readInventory.json().data.requestId).toBe('request-1');

    const calendar = await app.inject({
      method: 'PUT',
      url: `/v1/apartments/${apartmentId}/prices/calendar`,
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-apt-test',
        entries: [
          {
            date: '2026-06-01',
            price: 180,
            minStay: 2,
            availability: 'available',
          },
          {
            date: '2026-06-02',
            price: 190,
            availability: 'blocked',
          },
        ],
      },
    });
    expect(calendar.statusCode).toBe(200);
    expect(calendar.json().data).toHaveLength(2);

    const readCalendar = await app.inject({
      method: 'GET',
      url: `/v1/apartments/${apartmentId}/prices/calendar?workspaceId=ws-apt-test&from=2026-06-01&to=2026-06-30`,
      headers: authHeaders(token),
    });
    expect(readCalendar.statusCode).toBe(200);
    expect(readCalendar.json().data.map((entry: { date: string }) => entry.date)).toEqual([
      '2026-06-01',
      '2026-06-02',
    ]);

    const auditTypes = await app.mongoDb
      .collection('tz_authEvents')
      .find({
        workspaceId: 'ws-apt-test',
        eventType: {
          $in: [
            'apartment.sale_price.created',
            'apartment.sale_price.updated',
            'apartment.monthly_rent.created',
            'apartment.monthly_rent.updated',
            'apartment.inventory.updated',
            'apartment.price_calendar.upserted',
          ],
        },
      })
      .project({ eventType: 1 })
      .toArray();
    expect(new Set(auditTypes.map((event) => event.eventType))).toEqual(
      new Set([
        'apartment.sale_price.created',
        'apartment.sale_price.updated',
        'apartment.monthly_rent.created',
        'apartment.monthly_rent.updated',
        'apartment.inventory.updated',
        'apartment.price_calendar.upserted',
      ]),
    );
  });
});
