# Ponte verso il design-system (React)

I componenti React del DS **non** si importano con `@tecma/design-system-tokens/...` nel codice applicativo: qui ci sono solo `export *` verso `../../../../design-system/src/...`.

**Import previsto:** `@/tecma-ds/button`, `@/tecma-ds/avatar`, ecc.

**Nuovo componente DS:** aggiungi un file `nome.ts` con `export * from "../../../../design-system/..."` e importa da `@/tecma-ds/nome`.
