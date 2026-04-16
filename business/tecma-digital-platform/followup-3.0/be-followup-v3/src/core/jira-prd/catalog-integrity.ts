import type { FeatureCatalogEntry } from "./feature-catalog-types.js";
import { EPIC_IDS, EPIC_TITLES, type EpicId } from "./epic-registry.js";

/**
 * Validazione catalogo: id univoci, parent esistenti, assenza cicli, vincoli kind/parent, Epic coerenti.
 */
export function assertCatalogIntegrity(catalog: FeatureCatalogEntry[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const byId = new Map(catalog.map((e) => [e.idTema, e] as const));
  const epicSet = new Set<string>(EPIC_IDS);

  for (const e of catalog) {
    if (e.kind === "technical" && !e.parentIdTema) {
      errors.push(`Voce technical "${e.idTema}" senza parentIdTema`);
    }
    if (e.parentIdTema && !byId.has(e.parentIdTema)) {
      errors.push(`parentIdTema "${e.parentIdTema}" inesistente per "${e.idTema}"`);
    }
    if (!epicSet.has(e.epicId)) {
      errors.push(`epicId "${e.epicId}" non valido per "${e.idTema}"`);
    }
    const expectedTitle = EPIC_TITLES[e.epicId as EpicId];
    if (expectedTitle && e.epicTitle !== expectedTitle) {
      errors.push(`epicTitle non allineato a EPIC_TITLES per "${e.idTema}" (atteso titolo Epic ${e.epicId})`);
    }
    if (e.kind === "technical" && e.workItemKind !== "technical") {
      errors.push(`Voce technical "${e.idTema}" deve avere workItemKind "technical" (got ${e.workItemKind})`);
    }
    if (e.kind === "product" && e.workItemKind === "technical") {
      errors.push(`Voce product "${e.idTema}" non può avere workItemKind "technical"`);
    }
  }

  for (const e of catalog) {
    const seen = new Set<string>();
    let cur: string | undefined = e.parentIdTema;
    let steps = 0;
    while (cur) {
      if (seen.has(cur)) {
        errors.push(`Ciclo parent su "${e.idTema}" (nodo ripetuto "${cur}")`);
        break;
      }
      seen.add(cur);
      const parent = byId.get(cur);
      if (!parent) break;
      cur = parent.parentIdTema;
      if (++steps > 200) {
        errors.push(`Catena parent troppo profonda per "${e.idTema}"`);
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
