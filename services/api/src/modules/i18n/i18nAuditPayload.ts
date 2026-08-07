import crypto from 'node:crypto';

/**
 * Metadati per audit su body i18n (PUT `messages` / PATCH `patch`): dimensione JSON e prefisso SHA-256.
 * Non logga il contenuto completo delle stringhe.
 */
export function i18nAuditPayloadFromBody(body: unknown): {
  messagesBytes: number;
  messagesSha256Prefix: string;
} {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { messagesBytes: 0, messagesSha256Prefix: '' };
  }
  const rec = body as Record<string, unknown>;
  const subtree = rec.messages ?? rec.patch;
  if (subtree == null || typeof subtree !== 'object' || Array.isArray(subtree)) {
    return { messagesBytes: 0, messagesSha256Prefix: '' };
  }
  const json = JSON.stringify(subtree);
  const messagesBytes = Buffer.byteLength(json, 'utf8');
  const messagesSha256Prefix = crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
  return { messagesBytes, messagesSha256Prefix };
}
