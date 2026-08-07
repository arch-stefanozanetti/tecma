import { describe, expect, it } from 'vitest';

import { deepMergeI18nMessages } from './i18nMerge.js';

describe('deepMergeI18nMessages', () => {
  it('sovrascrive solo le foglie indicate', () => {
    const base = { a: { b: '1', c: '2' }, d: '3' };
    const override = { a: { b: 'x' } };
    expect(deepMergeI18nMessages(base, override)).toEqual({ a: { b: 'x', c: '2' }, d: '3' });
  });

  it('sostituisce array interi', () => {
    const base = { items: [1, 2] };
    const override = { items: [9] };
    expect(deepMergeI18nMessages(base, override)).toEqual({ items: [9] });
  });
});
