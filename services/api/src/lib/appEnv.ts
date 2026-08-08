/**
 * Risoluzione dell'ambiente applicativo della richiesta.
 *
 * `prod` e `demo` girano nello stesso processo e vengono distinti solo
 * dall'header `x-app-env`. Questa e' la parte piu' delicata dell'API: un errore
 * qui mescola i dati dei due ambienti. La logica vive qui, isolata e testata,
 * invece che inline dentro un hook.
 */

export type AppEnv = 'demo' | 'prod';

/**
 * Regola: solo il valore esatto `demo` (case-insensitive, spazi esterni
 * ignorati) seleziona l'ambiente demo. Qualunque altra cosa — header assente,
 * vuoto, sconosciuto, array, valore parziale come `demo-x` — ricade su `prod`.
 * Il default sicuro e' produzione perche' i dati demo non devono mai comparire
 * su un'installazione reale per via di un header malformato.
 */
export const resolveAppEnv = (headerValue: unknown): AppEnv => {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== 'string') return 'prod';
  return raw.trim().toLowerCase() === 'demo' ? 'demo' : 'prod';
};
