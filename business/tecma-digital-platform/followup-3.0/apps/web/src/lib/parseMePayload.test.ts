import { describe, expect, it } from 'vitest';

import { parseMePayload } from './parseMePayload';

describe('parseMePayload', () => {
  it('canonical { data: { id, email, systemRole } }', () => {
    expect(
      parseMePayload({
        data: {
          id: '507f1f77bcf86cd799439011',
          email: 'U@Tecma.TEST',
          systemRole: 'tecma_admin',
        },
      }),
    ).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'u@tecma.test',
      systemRole: 'tecma_admin',
    });
  });

  it('payload piatto senza data', () => {
    expect(
      parseMePayload({
        id: 'abc',
        email: 'a@b.c',
        systemRole: 'user',
      }),
    ).toEqual({ id: 'abc', email: 'a@b.c', systemRole: 'user' });
  });

  it('id numerico', () => {
    expect(
      parseMePayload({
        data: { id: 42, email: 'x@y.z', systemRole: 'user' },
      }),
    ).toEqual({ id: '42', email: 'x@y.z', systemRole: 'user' });
  });

  it('sub al posto di id (claim JWT)', () => {
    expect(
      parseMePayload({
        data: { sub: 'uid-1', email: 'e@e.e' },
      }),
    ).toEqual({ id: 'uid-1', email: 'e@e.e', systemRole: 'user' });
  });

  it('null se incompleto', () => {
    expect(parseMePayload({ data: { email: 'a@b.c' } })).toBeNull();
    expect(parseMePayload({ data: { id: '1' } })).toBeNull();
  });
});
