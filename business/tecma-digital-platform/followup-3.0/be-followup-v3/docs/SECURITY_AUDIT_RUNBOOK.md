# Runbook: audit di sicurezza (`tz_security_audit`)

## Scopo

La collezione Mongo **`tz_security_audit`** raccoglie eventi **append-only** per compliance e analisi (accessi, MFA, GDPR, inviti, mutazioni sensibili). Non sostituisce i log applicativi né un SIEM completo: è **difesa in profondità** con insert **best-effort** (fallimenti non bloccano la richiesta HTTP).

## Catalogo azioni (policy)

Aggiornare questa tabella quando si aggiunge un nuovo `recordSecurityEvent`.

| Azione | Contesto |
|--------|----------|
| `mfa.setup_started` | Inizio setup TOTP autenticato |
| `mfa.setup_completed` | Conferma setup MFA (metadata: solo conteggio backup codes) |
| `mfa.disabled` | Disattivazione MFA |
| `auth.password_reset_completed` | Reset password con token valido |
| `auth.invite_password_set` | Completamento registrazione da invito |
| `users.invited` | Invito utente da admin (metadata ruolo opzionale) |
| `gdpr.export_served` | Export dati GDPR consegnato |
| `gdpr.erasure_requested` | Richiesta cancellazione |
| `gdpr.consent_updated` | Aggiornamento consensi |
| `gdpr.erasure_completed` | Elaborazione erasure a batch (worker) |
| `document.signed_get_url_issued` | URL firmato S3 (metadata con hash chiave) |

**Altri eventi dominio** (workspace, client, request, contract, apartment, webhook, email flow, ecc.) sono registrati dalle rispettive route/servizi; elenco completo: cercare `recordSecurityEvent` nel sorgente.

## Monitoring e alert

- **Metrica** (OpenTelemetry): fallimenti insert incrementano `observeAsyncSideEffectFailure` con `operation: security_audit.record`. Configurare alert se il tasso supera una soglia (es. errori Mongo o schema).
- **Log**: `[securityAudit] insert failed` — correlare con `action` nel campo strutturato del log.
- **Non** inviare alert operativi su ogni singolo fallimento in-app senza deduplica: rischio rumore; preferire dashboard sulla metrica.

## Rate limiting

- Default: **in-memory** (`express-rate-limit`), efficace su **una replica**.
- **Multi-replica**: impostare `RATE_LIMIT_REDIS_URL` (URL Redis/TLS come supportato da `ioredis`) per usare uno store Redis condiviso sugli stessi limiter (login, MFA, public API, platform key, webhook, portale, ecc.).
- Test / `DISABLE_AUTH_RATE_LIMIT=1`: limiti disabilitati come da codice.

## Export schedulato (job-runner)

- Variabile **`SECURITY_AUDIT_EXPORT_DIR`**: se valorizzata, il job scrive file JSONL incrementali.
- **Watermark**: file di stato `.security-audit-export-state.json` nella stessa directory (`lastExportedObjectId`). Ogni run esporta fino a 25k documenti con `_id` strettamente maggiore del watermark, in ordine di `_id` crescente; poi aggiorna il watermark al massimo `_id` del batch.
- **Primo run** (nessuno stato): stesso criterio senza filtro `_id` → primi 25k documenti per `_id` crescente (baseline). Se la collezione è vuota, nessun file e nessun aggiornamento di stato.
- Se in un intervallo ci sono più di 25k eventi nuovi, i successivi run continueranno dalla fine del batch precedente (nessun buco se il job viene eseguito regolarmente).

## API compliance

- Query paginata e export JSONL autenticati con permesso **`COMPLIANCE_AUDIT_READ`**.
- L’export HTTP supporta `sortOrder=asc|desc` su campo `at` (non usa il watermark su disco).

## Test di integrazione in CI

Esempio workflow GitHub Actions (path monorepo adattabile): [ci-integration.example.yml](./ci-integration.example.yml). Comando locale: `npm run test:integration` (richiede env coerente con `vitest.integration.config.ts`).
