# Script di migrazione (pilota)

- **Runbook:** [docs/deliverables/PILOT_ETL_RUNBOOK.md](../../../docs/deliverables/PILOT_ETL_RUNBOOK.md)
- **Script operativo:** `migrate-legacy-pilot.ts` (`npm run migrate:legacy-pilot`)
- **Mapping progetto→workspace:** [docs/deliverables/legacy-project-workspace-mapping.json](../../../docs/deliverables/legacy-project-workspace-mapping.json)
- **Output report:** `docs/deliverables/reports/<PILOT_RUN_ID>.{json,md}`
- **Esempio idempotenza:** `pilot-etl-idempotency.example.ts` — non è incluso in `tsconfig` (`include` limitato a `src/`); eseguire con `npx tsx scripts/migration/pilot-etl-idempotency.example.ts` solo dopo aver adattato i parametri (non è un entrypoint di produzione).
