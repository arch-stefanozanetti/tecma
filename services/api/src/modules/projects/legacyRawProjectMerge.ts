/**
 * Merge non distruttivo per legacyPayload.rawProject: oggetti annidati in deep merge, array e primitive sostituite.
 * Portato dal POC (be-followup-v3) per allineare tz_projects al mirror legacy usato in migrazione read-only.
 */

export const MAX_LEGACY_JSON_BYTES = 2_500_000;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMergeRawProject(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMergeRawProject(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function assertJsonSize(value: unknown): void {
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    throw new Error('legacyPayload: valore non serializzabile in JSON');
  }
  if (s.length > MAX_LEGACY_JSON_BYTES) {
    throw new Error(
      `legacyPayload: dimensione JSON superiore al limite (${MAX_LEGACY_JSON_BYTES} byte)`,
    );
  }
}
