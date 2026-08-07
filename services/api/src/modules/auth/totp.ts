import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

export const generateTotpSecret = (bytes = 20): string => {
  const raw = crypto.randomBytes(bytes);
  let bits = '';
  for (const byte of raw) bits += byte.toString(2).padStart(8, '0');

  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return out;
};

const decodeBase32 = (input: string): Buffer => {
  const normalized = input.replaceAll(' ', '').replace(/=+$/g, '').toUpperCase();
  let bits = '';
  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error('Invalid base32 secret');
    bits += idx.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

export const generateTotpCode = (
  secret: string,
  options: { now?: number; stepSeconds?: number; digits?: number } = {},
): string => {
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const counter = Math.floor((options.now ?? Date.now()) / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
};

export const verifyTotpCode = (
  secret: string,
  code: string,
  options: { now?: number; window?: number; stepSeconds?: number } = {},
): boolean => {
  const normalizedCode = code.trim();
  if (!/^[0-9]{6}$/.test(normalizedCode)) return false;

  const now = options.now ?? Date.now();
  const stepMs = (options.stepSeconds ?? DEFAULT_STEP_SECONDS) * 1000;
  const window = options.window ?? 1;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, { now: now + offset * stepMs });
    const expectedBuffer = Buffer.from(expected);
    const codeBuffer = Buffer.from(normalizedCode);
    if (
      expectedBuffer.length === codeBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, codeBuffer)
    ) {
      return true;
    }
  }
  return false;
};

export const buildTotpUri = (params: {
  issuer: string;
  accountName: string;
  secret: string;
}): string => {
  const label = `${params.issuer}:${params.accountName}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
};
