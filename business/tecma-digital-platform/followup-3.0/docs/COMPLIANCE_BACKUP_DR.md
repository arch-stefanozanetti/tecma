# Backup, disaster recovery e alerting (FollowUp 3.0)

Documento operativo per allineamento a **SOC 2** / **ISO 27001** (controlli A.12, A.17 e monitoraggio). Il codice applicativo fornisce audit e metriche; RPO/RTO si raggiungono con **MongoDB Atlas** (o equivalente gestito) e procedure validate.

## Backup dati (RPO &lt; 24h)

- Abilitare **Continuous Cloud Backup** su Atlas (o snapshot giornalieri minimi) per il cluster che ospita `MONGO_DB_NAME`.
- Conservare **almeno 7** snapshot giornalieri + retention settimanale/mensile secondo policy aziendale.
- **Crittografia**: storage cifrato at-rest lato provider; per segreti MFA usare `AUTH_FIELD_ENCRYPTION_KEY` (32 byte base64) in produzione.

## Ripristino (RTO &lt; 4h)

1. Identificare il punto nel tempo (PIT) o lo snapshot da ripristinare.
2. Ripristinare in un nuovo cluster o collection clone secondo runbook Atlas.
3. Aggiornare `MONGO_URI` sul servizio Render (o ambiente di deploy) e ridistribuire.
4. Verificare: `GET /v1/health`, login di prova, lettura campione su un workspace.

## Test di ripristino (obbligatori per audit)

- **Frequenza consigliata**: trimestrale.
- **Evidenza**: ticket / registro con data, esecutore, esito (successo o gap), azioni correttive.

## Audit immutabile

- Collection **`tz_security_audit`**: inserimenti solo via app; ruolo DB applicativo senza `update`/`delete` su tale collection.
- Export NDJSON: `GET /v1/compliance/security-audit/export.jsonl` (permesso `compliance.audit.read`) per archiviazione esterna / SIEM.

## Metriche e alert

- Contatori OpenTelemetry: `followup_security_account_lockouts_total`, `followup_security_mfa_failures_total`.
- Configurare alert su spike di `4xx` su `/v1/auth/login` e sui contatori sopra (stack OTEL + backend alerting).

## Variabili ambiente rilevanti

| Variabile | Scopo |
|-----------|--------|
| `AUTH_FIELD_ENCRYPTION_KEY` | Cifratura segreti MFA (obbligatoria in prod) |
| `AUTH_LOCKOUT_*` | Lockout account dopo tentativi falliti |
| `AUTH_MFA_REQUIRED_GLOBALLY` | MFA obbligatorio per utenti con membership workspace |
| Flag `mfaRequired` su `tz_workspaces` | MFA obbligatorio per membership di quel workspace |
