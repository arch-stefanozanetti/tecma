import { describe, expect, it } from 'vitest';

import {
  ApiError,
  apiErrorBody,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from './apiError.js';

describe('ApiError envelope', () => {
  it('serializza envelope canonico con traceId e details', () => {
    const body = apiErrorBody(
      new ApiError({
        code: 'ValidationError',
        message: 'Invalid payload',
        status: 400,
        details: [{ field: 'email', messageDetail: ['Invalid email'] }],
      }),
      'trace-1',
    );

    expect(body).toEqual({
      error: {
        code: 'ValidationError',
        message: 'Invalid payload',
        status: 400,
        traceId: 'trace-1',
        details: [{ field: 'email', messageDetail: ['Invalid email'] }],
      },
    });
  });

  it('espone helper standard per 400/401/403/404/409', () => {
    expect(badRequest('bad').status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    expect(conflict('conflict').status).toBe(409);
  });
});
