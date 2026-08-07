import { ObjectId } from 'mongodb';

/**
 * Converte valori BSON / Node non nativi in JSON in tipi che `JSON.stringify` accetta
 * (evita 500 su risposta Fastify quando i documenti Mongo contengono Long, Decimal128, ecc.).
 */
export function jsonSafeReplacer(_key: string, value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value != null && typeof value === 'object') {
    const v = value as { _bsontype?: string; toString?: () => string; buffer?: ArrayBuffer };
    const t = v._bsontype;
    if (t === 'Long' || t === 'Decimal128' || t === 'Double' || t === 'Int32') {
      return typeof v.toString === 'function' ? v.toString() : String(value);
    }
    if (t === 'Binary') {
      try {
        const bin = value as { buffer?: ArrayBuffer };
        const raw = bin.buffer;
        if (raw instanceof ArrayBuffer) {
          return Buffer.from(new Uint8Array(raw)).toString('base64');
        }
        return undefined;
      } catch {
        return undefined;
      }
    }
  }
  return value;
}

/** Ritorna una copia plain-object serializzabile JSON degli attributi di primo livello (come lista utenti). */
export function serializeRecordForJsonApi<T extends Record<string, unknown>>(row: T): T {
  return JSON.parse(JSON.stringify(row, jsonSafeReplacer)) as T;
}
