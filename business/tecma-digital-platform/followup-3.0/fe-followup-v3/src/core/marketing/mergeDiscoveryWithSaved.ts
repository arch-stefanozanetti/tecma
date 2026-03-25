/**
 * Se il progetto ha già un ID salvato ma l'API non lo restituisce più,
 * mostriamo comunque una voce in tendina (solo lettura concettuale, stesso valore).
 */

export type AdsCustomerRow = { customerId: string; resourceName: string };

export function mergeAdsCustomers(api: AdsCustomerRow[], savedCustomerId: string): AdsCustomerRow[] {
  const saved = savedCustomerId.trim();
  const list = [...api];
  if (saved && !list.some((c) => c.customerId === saved)) {
    return [{ customerId: saved, resourceName: "__saved_on_project__" }, ...list];
  }
  return list;
}

export type Ga4PropertyRow = { propertyId: string; displayName: string; accountDisplayName?: string };

export function mergeGa4Properties(api: Ga4PropertyRow[], savedPropertyId: string): Ga4PropertyRow[] {
  const saved = savedPropertyId.trim();
  const list = [...api];
  if (saved && !list.some((p) => p.propertyId === saved)) {
    return [
      {
        propertyId: saved,
        displayName: "Salvata sul progetto (non compare nell'elenco API)",
        accountDisplayName: undefined,
      },
      ...list,
    ];
  }
  return list;
}

export type MetaAdAccountRow = { id: string; name?: string; accountId: string };

export function mergeMetaAdAccounts(api: MetaAdAccountRow[], savedAccountId: string): MetaAdAccountRow[] {
  const saved = savedAccountId.trim();
  const list = [...api];
  if (saved && !list.some((a) => a.id === saved)) {
    return [
      {
        id: saved,
        name: "Salvato sul progetto (non compare nell'elenco API)",
        accountId: saved.replace(/^act_/i, ""),
      },
      ...list,
    ];
  }
  return list;
}

export function adsOptionLabel(c: AdsCustomerRow): string {
  if (c.resourceName === "__saved_on_project__") {
    return `${c.customerId} (salvato sul progetto)`;
  }
  return c.customerId;
}
