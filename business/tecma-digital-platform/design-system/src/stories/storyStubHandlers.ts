/**
 * Placeholder per callback nelle story (Select, Tag).
 *
 * Evitiamo `@storybook/addon-actions` e `@storybook/test` in questi file: con Storybook 8 +
 * Vite 6 il caricamento lazy dello story chunk tira dentro un pre-bundle da
 * `node_modules/.cache/storybook/.../sb-vite/deps/` che spesso fallisce con
 * "error loading dynamically imported module" in dev.
 *
 * Gli altri componenti non importano quei package → nessun problema.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- story placeholder
export function noop(): void {}
