# OpenAPI baseline files (TECMA-BSS)

## Uso nel pack Followup 3.1

- **Ruolo:** impronte **sha256** (e size) dei due artefatti TECMA-BSS al **2026-04-23** per rilevare drift involontario tra revisioni del pack e working tree locale.
- **Verifica rapida** (macOS/Linux):  
  `shasum -a 256 "/Users/s.zanetti/dev/tecma/architecture/aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml"`  
  e stesso comando sul file **raw**; confrontare con i valori sotto.
- **Interpretazione:** **public** vs **raw** possono divergere (già documentato in `05-api-contract-alignment-spec.md`); un hash diverso da questo file non è “errore” se la modifica è voluta e tracciata in MR + `07` §9b.
- **Aggiornamento:** dopo merge rilevanti su `architecture/aws-api-gateway`, ricalcolare hash e bytes e **sostituire** le righe in questo documento (stessa policy: evitare file baseline paralleli senza accordo).

**Riferimenti pack:** `05-api-contract-alignment-spec.md`, `07` §9 (Spectral/Newman), `_openapi_recent_history_2026-04-23.md`.

---

- `/Users/s.zanetti/dev/tecma/architecture/aws-api-gateway/api/TECMA-BSS/public/tecma-bss-swagger.yaml`: bytes=67360 sha256=`52f1db15e05dff27d0fe9e326648f67f3edf8baafb3dee7e9d608815005a6611`
- `/Users/s.zanetti/dev/tecma/architecture/aws-api-gateway/api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml`: bytes=82303 sha256=`5ef2a5b5ac2ae0b563b42586ca084edea36d339a09861d890c1c9cb71b9c00b2`
