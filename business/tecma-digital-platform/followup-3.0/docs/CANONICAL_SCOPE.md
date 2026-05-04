# Ambito canonico Followup 3.0

## Source of truth

Lo sviluppo attivo di Followup 3.0 avviene esclusivamente in questo perimetro greenfield:

- `apps/web` — frontend canonico
- `services/api` — backend canonico
- `packages/*` — librerie condivise del monorepo
- `tests/*` — suite e hardening cross-package
- `architecture/aws-api-gateway` — governance contratti OpenAPI

## Fuori scope

Non fanno parte del runtime o del ciclo di sviluppo canonico:

- qualsiasi copia legacy di backend/frontend
- repository o cartelle POC usate solo come riferimento read-only
- moduli di supporto non inclusi nel workspace pnpm

## Regole operative

- Nuove feature e fix: solo in `apps/web`, `services/api`, `packages/*`.
- Qualsiasi riferimento a codice legacy deve restare storico/documentale, non operativo.
- CI, test e security gate devono puntare solo ai path canonici del monorepo.
