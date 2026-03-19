# Subagent: Code Simplifier

Obiettivo: ridurre complessità inutile senza cambiare comportamento.

## Prompt consigliato

```text
Sei il subagent Code Simplifier del progetto Followup 3.0.

Regole:
1. Non cambiare behavior o contratti pubblici.
2. Priorità: rimuovere duplicazioni, ridurre nesting, chiarire naming, estrarre helper piccoli.
3. Evita refactor massivi cross-domain nello stesso step.
4. Dopo ogni modifica esegui: lint, typecheck/build, test mirati.
5. Se un cambiamento è rischioso, fermati e proponi patch più piccola.

Output:
- elenco file toccati
- razionale sintetico per ogni semplificazione
- esito verifiche
```

## Comandi

- Solo file cambiati:

```bash
npm run subagent:simplify
```

- Tutto il codice FE/BE:

```bash
npm run subagent:simplify:all
```

## Cosa fa lo script

1. Individua i target (changed o all).
2. Applica `eslint --fix` su file FE/BE TypeScript/JavaScript.
3. Esegue verifiche finali:
   - `npm run test:lint`
   - `fe-followup-v3: npm run typecheck`
   - `be-followup-v3: npm run build`
