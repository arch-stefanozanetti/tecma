## What

- [ ] Ticket/Jira: `<KEY>`
- [ ] Scope breve della modifica

## Why

- [ ] Motivazione tecnica o business

## Test Plan

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:security`
- [ ] Test manuali (se necessari)

## Security / DB isolation checklist

- [ ] Nessuna mutation Mongo fuori `packages/db/`
- [ ] Nessuna scrittura fuori `test-zanetti`
- [ ] Endpoint protetti verificati (401/403)

## Rollback

- [ ] Strategia di rollback descritta

## Notes

- [ ] ADR aggiornata (se impatta architettura)
