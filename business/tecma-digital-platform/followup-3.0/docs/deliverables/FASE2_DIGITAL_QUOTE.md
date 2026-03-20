# Fase 2 — Preventivo digitale + magic link

**Dipendenze:** Fase 1 (modello quote), Fase 3 (bucket S3 funzionante).

## Obiettivo prodotto

- Transizione stato trattativa → creazione record preventivo.
- Pagina pubblica con token firmato, scadenza, audit.
- PDF generato → upload storage → URL persistito.

## Passi implementativi suggeriti

1. Schema persistito `tz_quotes` (o equivalente) allineato al mapping Fase 1.
2. Servizio generazione token magic link (secret env, TTL configurabile).
3. Route pubblica read-only + rate limit.
4. Pipeline PDF (libreria scelta in repo) + `assets-s3.service` per upload.
5. FE admin: anteprima, rigenera link, stato invio.

## Definition of Done

- [ ] Creazione quote da UI con stato trattativa
- [ ] Link pubblico valido fino a scadenza
- [ ] PDF e URL salvati e verificabili
