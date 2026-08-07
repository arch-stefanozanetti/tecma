import { describe, expect, it } from 'vitest';

import { pickProjectIdsAfterFallback } from './pickProjectIdsAfterFallback.js';

describe('pickProjectIdsAfterFallback', () => {
  it('preferisce sempre gli assignment se presenti', () => {
    expect(
      pickProjectIdsAfterFallback({
        assignmentIds: ['p1', 'p2'],
        fallbackAllowed: true,
        workspaceLinkIds: ['p99'],
      }),
    ).toEqual(['p1', 'p2']);
  });

  it('deduplica gli assignment', () => {
    expect(
      pickProjectIdsAfterFallback({
        assignmentIds: ['p1', 'p1', 'p2'],
        fallbackAllowed: false,
        workspaceLinkIds: [],
      }),
    ).toEqual(['p1', 'p2']);
  });

  it('usa il fallback solo se non ci sono assignment e fallbackAllowed', () => {
    expect(
      pickProjectIdsAfterFallback({
        assignmentIds: [],
        fallbackAllowed: true,
        workspaceLinkIds: ['a', 'b'],
      }),
    ).toEqual(['a', 'b']);
  });

  it('senza assignment e senza fallback → vuoto', () => {
    expect(
      pickProjectIdsAfterFallback({
        assignmentIds: [],
        fallbackAllowed: false,
        workspaceLinkIds: ['x'],
      }),
    ).toEqual([]);
  });

  it('filtra stringhe vuote', () => {
    expect(
      pickProjectIdsAfterFallback({
        assignmentIds: ['p1', '', '  '],
        fallbackAllowed: true,
        workspaceLinkIds: [],
      }),
    ).toEqual(['p1']);
  });
});
