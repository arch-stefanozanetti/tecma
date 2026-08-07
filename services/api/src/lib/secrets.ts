import crypto from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

const deriveFallbackKey = (): Buffer => {
  const seed =
    process.env.APP_SECRETS_KEY_FALLBACK ?? process.env.AUTH_JWT_SECRET ?? 'tecma-dev-seed';
  return crypto.createHash('sha256').update(seed, 'utf8').digest();
};

const resolveSecretKey = (): Buffer => {
  const raw = (process.env.APP_SECRETS_KEY ?? '').trim();
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  const appEnv = (process.env.APP_ENV ?? '').toLowerCase();
  const isStrictEnv =
    nodeEnv === 'production' || nodeEnv === 'staging' || appEnv === 'prod' || appEnv === 'demo';
  if (raw === '') {
    if (isStrictEnv) {
      throw new Error('APP_SECRETS_KEY is required in staging/production environments');
    }
    return deriveFallbackKey();
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== KEY_LENGTH_BYTES) {
    throw new Error('APP_SECRETS_KEY must be base64 for 32-byte key');
  }
  return decoded;
};

export const isEncryptedSecret = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);

export const encryptSecret = (plaintext: string): string => {
  if (plaintext === '') return '';
  const key = resolveSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
};

export const decryptSecret = (value: string): string => {
  if (value === '') return '';
  if (!isEncryptedSecret(value)) return value;
  const raw = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const tag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + 16);
  const encrypted = raw.subarray(IV_LENGTH_BYTES + 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', resolveSecretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

export const maskedSecret = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined;
  if (isEncryptedSecret(value)) return '********';
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
};

export const ensureEncryptedSecret = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined;
  if (isEncryptedSecret(value)) return value;
  return encryptSecret(value);
};
