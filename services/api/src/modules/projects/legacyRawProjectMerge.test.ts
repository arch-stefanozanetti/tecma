import { describe, expect, it } from 'vitest';

import {
  assertJsonSize,
  deepMergeRawProject,
  MAX_LEGACY_JSON_BYTES,
} from './legacyRawProjectMerge.js';

describe('legacyRawProjectMerge', () => {
  it('deepMergeRawProject unisce oggetti annidati senza distruggere chiavi esistenti', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const patch = { b: 2, nested: { y: 3, z: 4 } };
    expect(deepMergeRawProject(base, patch)).toEqual({
      a: 1,
      b: 2,
      nested: { x: 1, y: 3, z: 4 },
    });
  });

  it('assertJsonSize rifiuta payload troppo grandi', () => {
    const huge = { x: 'y'.repeat(MAX_LEGACY_JSON_BYTES) };
    expect(() => assertJsonSize(huge)).toThrow(/dimensione JSON/);
  });
});
