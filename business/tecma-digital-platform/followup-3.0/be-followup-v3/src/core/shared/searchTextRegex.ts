/** Limite caratteri per searchText sulle query lista (mitiga ReDoS e carichi Mongo). */
export const MAX_LIST_SEARCH_TEXT_LENGTH = 200;

/** Escape per uso come sottostringa letterale in $regex Mongo (non ReDoS-safe al 100% ma elimina operatori regex). */
export function escapeForMongoRegexSubstring(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
