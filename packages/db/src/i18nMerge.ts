/**
 * Merge profondo di messaggi i18n (oggetti annidati). Le foglie in `override` vincono su `base`.
 * Array e valori primitivi: l’override sostituisce interamente il ramo.
 */
export function deepMergeI18nMessages(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, overrideVal] of Object.entries(override)) {
    const baseVal = base[key];
    if (
      overrideVal != null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal != null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[key] = deepMergeI18nMessages(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      out[key] = overrideVal;
    }
  }
  return out;
}
