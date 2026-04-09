# Fase 3 — Verifica S3 / storage

**Riferimenti codice:** `be-followup-v3/src/core/assets/assets-s3.service.ts`, `emailFlowAssetUpload.service.ts`. Deploy: [RENDER_DEPLOY.md](../RENDER_DEPLOY.md).

## Variabili ambiente

| Variabile | Ruolo |
|-----------|--------|
| `ASSETS_S3_BUCKET` | Bucket principale asset (fallback possibile da email bucket) |
| `EMAIL_FLOW_S3_BUCKET` | Fallback / flussi email |
| `EMAIL_FLOW_S3_PUBLIC_BASE_URL` | Opzionale, URL pubblico asset email |
| `AWS_ACCESS_KEY_ID` | Credenziali SDK |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_REGION` | |

## Checklist verifica (staging/prod)

- [ ] Variabili impostate su Render (o `.env` locale con bucket di test).
- [ ] Policy IAM: `PutObject`, `GetObject`, `DeleteObject` sul prefisso usato dall’app.
- [ ] **Diagnostica API (Tecma admin):** `GET /v1/tecma/storage/assets-diagnostics` (solo JWT Tecma) → stato bucket/regione/credenziali senza segreti; con `?probe=1` esegue `HeadBucket` sul bucket configurato (verifica rete/IAM). Stessa informazione dalla console **Tecma → Entitlement** (sezione “Storage asset (S3)” in fondo pagina).
- [ ] Presigned PUT: upload file di prova &lt; 1 MB (flusso asset workspace o tab storage progetto).
- [ ] Presigned GET: download dello stesso file.
- [ ] Cancellazione o lifecycle secondo policy privacy.

## Note

Eseguire i test da ambiente con rete verso AWS; in CI si può mockare il client se necessario. La diagnostica `probe` richiede credenziali AWS valide e permessi `s3:ListBucket` / accesso `HeadBucket` sul bucket.
