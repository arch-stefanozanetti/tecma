import { z } from 'zod';

import type { I18nAppNamespace, SupportedI18nLocale } from './constants.js';
import { isI18nAppNamespace, isSupportedI18nLocale } from './constants.js';

/** Limite serializzazione JSON `messages` (~512 KiB). */
export const I18N_MESSAGES_JSON_MAX_BYTES = 512 * 1024;

export const i18nBundleUpsertBodySchema = z
  .object({
    messages: z.record(z.string(), z.unknown()).describe('Albero messaggi i18n per il namespace'),
    version: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        'Se inviata, deve coincidere con `version` corrente sul server (optimistic lock); altrimenti 409',
      ),
  })
  .strict();

export type I18nBundleUpsertBody = z.infer<typeof i18nBundleUpsertBodySchema>;

/** Merge profondo di `patch` sui `messages` già persistiti (fase 2). */
export const i18nBundlePatchBodySchema = z
  .object({
    patch: z
      .record(z.string(), z.unknown())
      .describe('Sotto-albero da unire in profondità ai messages esistenti'),
    version: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        'Se inviata, deve coincidere con `version` corrente sul server (optimistic lock); altrimenti 409',
      ),
  })
  .strict();

export type I18nBundlePatchBody = z.infer<typeof i18nBundlePatchBodySchema>;

export const messagesJsonByteLength = (messages: Record<string, unknown>): number =>
  Buffer.byteLength(JSON.stringify(messages), 'utf8');

export const parseLocaleParam = (raw: string | undefined): SupportedI18nLocale | null => {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return isSupportedI18nLocale(v) ? v : null;
};

export const parseNamespaceParam = (raw: string | undefined): I18nAppNamespace | null => {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return isI18nAppNamespace(v) ? v : null;
};
