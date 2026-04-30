import type { Ga4PropertyRow } from "./mergeDiscoveryWithSaved";

export const GA4_ACCOUNT_FALLBACK_LABEL = "Account non indicato";

export type Ga4AccountGroup = {
  /** Chiave stabile per la lista account (etichetta normalizzata) */
  accountKey: string;
  accountLabel: string;
  properties: Ga4PropertyRow[];
};

/**
 * Raggruppa proprietà GA4 per account (accountDisplayName), come in Looker Studio.
 */
export function groupGa4PropertiesByAccount(properties: Ga4PropertyRow[]): Ga4AccountGroup[] {
  const map = new Map<string, Ga4PropertyRow[]>();
  for (const p of properties) {
    const label = (p.accountDisplayName ?? "").trim() || GA4_ACCOUNT_FALLBACK_LABEL;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(p);
  }
  const groups: Ga4AccountGroup[] = [...map.entries()].map(([accountLabel, props]) => ({
    accountKey: accountLabel,
    accountLabel,
    properties: [...props].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "it", { sensitivity: "base" })
    ),
  }));
  groups.sort((a, b) =>
    a.accountLabel.localeCompare(b.accountLabel, "it", { sensitivity: "base" })
  );
  return groups;
}
