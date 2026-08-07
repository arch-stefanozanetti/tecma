/**
 * Logica pura: prima si usano gli ID dai ruoli utente-progetto nel workspace;
 * se non ce ne sono e il fallback è consentito (admin o membership workspace),
 * si usano tutti i progetti collegati al workspace.
 */
export function pickProjectIdsAfterFallback(params: {
  assignmentIds: string[];
  fallbackAllowed: boolean;
  workspaceLinkIds: string[];
}): string[] {
  const clean = (ids: string[]) =>
    Array.from(
      new Set(
        ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter((id) => id.length > 0),
      ),
    );

  if (params.assignmentIds.length > 0) {
    return clean(params.assignmentIds);
  }
  if (params.fallbackAllowed) {
    return clean(params.workspaceLinkIds);
  }
  return [];
}
