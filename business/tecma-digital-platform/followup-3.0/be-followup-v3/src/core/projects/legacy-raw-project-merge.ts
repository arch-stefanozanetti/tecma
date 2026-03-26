/**
 * Merge non distruttivo per legacyPayload.rawProject: oggetti annidati in deep merge, array e primitive sostituite.
 */

export const MAX_LEGACY_JSON_BYTES = 2_500_000;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergeRawProject(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
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

export function setDeep(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return { ...obj };
  const [head, ...rest] = path;
  if (!head) return { ...obj };
  const clone = { ...obj };
  if (rest.length === 0) {
    clone[head] = value;
    return clone;
  }
  const next = clone[head];
  const nested = isPlainObject(next) ? (next as Record<string, unknown>) : {};
  clone[head] = setDeep(nested, rest, value);
  return clone;
}

export type AdvancedOverrideRow = {
  path: string;
  valueType: "string" | "number" | "boolean";
  stringValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
};

export function applyAdvancedPathOverrides(
  root: Record<string, unknown>,
  rows: AdvancedOverrideRow[] | undefined
): Record<string, unknown> {
  if (!rows || rows.length === 0) return root;
  let out = { ...root };
  for (const row of rows) {
    const path = row.path.trim();
    if (!path) continue;
    const segments = path.split(".").filter((s) => s.length > 0);
    if (segments.length === 0) continue;
    const value =
      row.valueType === "number"
        ? row.numberValue
        : row.valueType === "boolean"
          ? row.booleanValue
          : row.stringValue;
    out = setDeep(out, segments, value);
  }
  return out;
}

export function assertJsonSize(value: unknown): void {
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    throw new Error("legacyPayload: valore non serializzabile in JSON");
  }
  if (s.length > MAX_LEGACY_JSON_BYTES) {
    throw new Error(`legacyPayload: dimensione JSON superiore al limite (${MAX_LEGACY_JSON_BYTES} byte)`);
  }
}
