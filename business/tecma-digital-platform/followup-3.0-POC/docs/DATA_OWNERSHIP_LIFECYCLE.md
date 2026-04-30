# Data Ownership & Lifecycle (Inter-app)

## Ownership primaria
- `tz_clients`, `tz_apartments`, `tz_requests`: owned da Followup core.
- `tz_platform_*`: owned dal boundary platform (consumer esterni).
- `tz_signature_requests`: owned da contracts/signing domain.
- `tz_marketing_*`: owned da marketing automation domain.
- `tz_mls_*`: owned da MLS integration domain.

## Regole lifecycle
- Dati core: retention operativa illimitata salvo policy GDPR.
- Audit/security: retention minima 365 giorni (configurabile).
- Sessioni/chiavi: TTL e revoca esplicita.
- Export/erase GDPR applicati ai dati PII con propagazione su entità collegate.

## Contract tra app
- Accesso esterno solo via API boundary (`/v1/platform/*`) o feed dedicati MLS.
- Nessun accesso diretto a collection Mongo da mini-app esterne.
- Versionamento payload obbligatorio per eventi realtime/platform.

## Criteri estrazione microservizi (Wave 13 gate)
- Ownership team chiara.
- SLA distinto rispetto al core CRM.
- Necessità di scaling indipendente.
- Riuso cross-app dimostrato da metriche reali.

