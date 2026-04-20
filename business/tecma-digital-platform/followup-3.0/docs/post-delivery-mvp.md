# Post-vendita MVP (difetti + handover)

Implementazione nativa in FollowUp 3.0: **segnalazioni su unità** (`tz_unit_issues`) e **sessione checklist consegna** (`tz_handovers`, una per unità), con permessi `post_delivery.read` / `post_delivery.update`.

## Backend (`be-followup-v3`)

- **Indici:** `ensureIndexes.ts` — liste e vincolo unico `(workspaceId, apartmentId)` su `tz_handovers`.
- **Servizi:** `src/core/post-delivery/unit-issues.service.ts`, `handovers.service.ts`, template `handover-checklist-template.ts`.
- **Route (prefisso API `/v1`):**
  - `POST /unit-issues/query` — lista paginata (`ListQuery`, filtri opz. `apartmentId`, `status`).
  - `POST /unit-issues` — crea (valida unità in `tz_apartments`).
  - `GET /unit-issues/:id?workspaceId=`
  - `PATCH /unit-issues/:id` — body con `workspaceId`, `projectId`, campi parziali.
  - `DELETE /unit-issues/:id?workspaceId=&projectId=`
  - `POST /handovers/query`
  - `POST /handovers` — get-or-create per unità.
  - `GET /handovers/for-apartment?workspaceId=&projectId=&apartmentId=`
  - `GET /handovers/:id?workspaceId=`
  - `PATCH /handovers/:id` — `sessionStatus`, aggiornamenti `checklist` per `itemId`.

## Frontend (`fe-followup-v3`)

- Tipi: `types/domain.ts` (`UnitIssueRow`, `HandoverRow`, …).
- Client: `src/api/domains/postDeliveryApi.ts`, esposto come `followupApi.postDelivery`.
- UI: tab **Post-vendita** su scheda appartamento (`ApartmentDetailPostVenditaTab`).

## OpenAPI / API Gateway

Il servizio FollowUp espone gli endpoint sopra sul backend applicativo. Se il team mantiene contratti in `architecture/aws-api-gateway`, va aggiunto un dominio o estensione documentata e lint Spectral prima del merge; finché il gateway non è allineato, il contratto effettivo è questo documento + il codice.

## Binario B — AI (catalogo + spike)

Vedi [ai-provider-architecture-spike.md](./ai-provider-architecture-spike.md) e il catalogo connettori (`AI & Assistants`, cluster `ai`) in `fe-followup-v3`.
