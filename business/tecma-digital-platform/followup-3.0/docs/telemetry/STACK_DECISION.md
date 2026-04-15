# Decisione stack — raccolta eventi prodotto

**Data (logica piano):** 2026  
**Stato:** accettato per implementazione MVP.

## Opzioni valutate

| Criterio | PostHog (cloud EU) | Mixpanel | API backend + Mongo |
|----------|-------------------|----------|---------------------|
| Time-to-value | Alto | Alto | Basso (sviluppo BE) |
| Funnel / cohort | Sì | Sì | Da costruire |
| Feature flags | Integrati | Limitati / add-on | Custom |
| Session replay | Opt-in | Simile | No |
| GDPR / EU | Progetto EU, DPA | Simile | Controllo totale on-prem |
| Manutenzione | Bassa | Bassa | Alta |

## Decisione

**Transport primario:** [PostHog](https://posthog.com) JavaScript SDK (`posthog-js`), inizializzazione solo se `VITE_PUBLIC_POSTHOG_KEY` è valorizzata.

- **Host API default:** `https://eu.i.posthog.com` (EU) — sovrascrivibile con `VITE_PUBLIC_POSTHOG_HOST`.
- **Alternativa futura:** endpoint `POST /v1/telemetry/events` nel BE (Opzione B del piano) per tenant che non possono usare SaaS; il wrapper FE può essere esteso con un adapter.

## Ambienti

| Ambiente | Chiavi | Note |
|----------|--------|------|
| Locale | Opzionali; spesso disabilitato | Nessun invio se key assente |
| Staging | Progetto PostHog dedicato “staging” | Verificare funnel prima di prod |
| Produzione | Progetto PostHog “production”, region EU | Variabili su Render / CI |

## Campionamento

- Variabile opzionale futura: `VITE_PUBLIC_TELEMETRY_SAMPLE_RATE` (0–1) per ridurre volume in rollout graduale (non obbligatorio in v1).
