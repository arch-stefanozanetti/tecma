/**
 * Class name helper: filtra falsy e unisce con spazio.
 * Usato da tutti i componenti DS per className.
 */
export function cn(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
