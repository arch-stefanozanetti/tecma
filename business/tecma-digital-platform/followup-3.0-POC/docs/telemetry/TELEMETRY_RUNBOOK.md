# Runbook telemetry prodotto (Followup 3.0 FE)

## Scopo

Operare in modo sicuro la raccolta eventi **first-party** verso **PostHog** (host EU), senza PII nei payload.

## Prerequisiti

- Progetto PostHog con regione **EU** e **DPA** firmata (vedi [TELEMETRY_LEGAL_AND_DISCOVERY.md](TELEMETRY_LEGAL_AND_DISCOVERY.md))
- Variabili build FE (vedi `fe-followup-v3/.env.example`):
  - `VITE_PUBLIC_POSTHOG_KEY` — API key progetto (pubblica nel bundle)
  - `VITE_PUBLIC_POSTHOG_HOST` — default `https://eu.i.posthog.com` se omesso

## Comportamento

- Se **`VITE_PUBLIC_POSTHOG_KEY` è assente o vuota**: nessuna chiamata PostHog; `trackProductEvent` è no-op.
- **Autocapture disattivata**; solo eventi del [EVENT_CATALOG.md](EVENT_CATALOG.md).
- Codice: `fe-followup-v3/src/telemetry/` (`initPosthog.ts`, `trackProductEvent.ts`, `ProductTelemetryBridge.tsx`).

## Checklist deploy

1. Impostare le variabili nell’ambiente di build (CI/Render) per **staging** e **produzione** con chiavi distinte se richiesto.
2. Verificare in PostHog che gli eventi `app.session.start` arrivano dopo login con scope progetto.
3. Controllare che non compaiano stringhe utente/note nei property (solo ID workspace, sezioni, codici normalizzati).

## Incidenti

| Sintomo | Azione |
|---------|--------|
| Picco di errori lato PostHog | Verificare quota/rate limit; ridurre campionamento eventi opzionali in una release futura |
| Richiesta cancellazione dati utente | Procedura GDPR: export/cancellazione tramite strumenti PostHog + tracciabilità ticket |
| Dubbio su dato sensibile in un evento | Bloccare la release, aggiornare catalogo e codice prima di proseguire |

## Privacy e informativa

- Riferimento normativo e checklist: [TELEMETRY_LEGAL_AND_DISCOVERY.md](TELEMETRY_LEGAL_AND_DISCOVERY.md)
- Testo per utenti finali: inserire link all’**informativa privacy** del prodotto / workspace nella documentazione cliente e, se richiesto dal legale, banner o sezione impostazioni per opt-out (valutazione caso per caso).

## Documenti correlati

- [STACK_DECISION.md](STACK_DECISION.md) — scelta PostHog vs API BE
- [KPI_AND_DASHBOARDS.md](KPI_AND_DASHBOARDS.md) — metriche e dashboard
