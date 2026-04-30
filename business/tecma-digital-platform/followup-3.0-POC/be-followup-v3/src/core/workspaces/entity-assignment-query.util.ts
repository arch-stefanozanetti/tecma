/**
 * Viewer context per filtrare liste cliente/appartamento in base a tz_entity_assignments (PIANO_GLOBALE §3.2).
 * Regola: entità senza riga di assegnazione nel workspace → visibili a tutti;
 * se esiste assegnazione → visibile solo all’utente assegnato (e admin/Tecma).
 */
export type EntityAssignmentListViewer = {
  email: string;
  isAdmin: boolean;
  isTecmaAdmin?: boolean;
};

export function shouldApplyEntityAssignmentListFilter(viewer: EntityAssignmentListViewer | undefined): boolean {
  if (!viewer) return false;
  if (viewer.isTecmaAdmin) return false;
  if (viewer.isAdmin) return false;
  return true;
}

/** userId nelle assegnazioni è email normalizzata lowercase */
export function viewerAssignmentUserId(viewer: EntityAssignmentListViewer): string {
  return viewer.email.trim().toLowerCase();
}
