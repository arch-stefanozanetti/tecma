# Webhook stato firme (`POST /v1/contracts/signature-requests/webhook`)

## Autenticazione attuale

1. **Segreto condiviso** (`SIGNATURE_WEBHOOK_SECRET`, ≥16 caratteri in produzione/staging), inviato come:
   - `Authorization: Bearer <secret>`, oppure
   - header `x-signature-webhook-secret`
2. **Rate limiting** per IP.
3. **Allowlist IP opzionale** (`SIGNATURE_WEBHOOK_ALLOWED_CIDRS`): elenco separato da virgole di indirizzi IPv4 o CIDR IPv4 (es. `203.0.113.5,198.51.100.0/24`). Se non vuota, solo quegli IP possono invocare il webhook (oltre al segreto valido). Utile dietro reverse proxy con `trust proxy` configurato.

## Operatività

- **Rotazione segreto**: aggiornare `SIGNATURE_WEBHOOK_SECRET` nel backend e negli script/integrazioni che chiamano il webhook nello stesso deployment; pianificare sovrapposizione breve solo se il provider supporta due segreti (oggi ne supportiamo uno).
- **Provider (DocuSign / YouSign)**: dove il vendor espone firma HMAC sul payload grezzo, valutare una seconda verifica oltre al Bearer (non implementata genericamente qui perché dipende dal vendor).
- **Monitoraggio**: alert su 401/403 massicci sul path webhook (tentativi di indovinare segreto o IP sbagliati).

## Variabili d’ambiente

| Variabile | Obbligatorio | Descrizione |
|-----------|--------------|-------------|
| `SIGNATURE_WEBHOOK_SECRET` | Sì (prod/staging) | Segreto condiviso con chi invia il POST. |
| `SIGNATURE_WEBHOOK_ALLOWED_CIDRS` | No | IP/CIDR IPv4 ammessi; vuoto = qualsiasi IP (solo segreto). |
