# Realtime event bus

Il bus eventi realtime (SSE `/v1/realtime/stream`) può funzionare in due modalità:

## In-memory (default)

- Nessuna variabile d’ambiente richiesta.
- Adatto a **singola istanza** (uno solo pod/processo).
- Gli eventi non sono condivisi tra istanze.

## Redis (multi-istanza)

- Impostare **`REALTIME_REDIS_URL`** con l’URL di connessione Redis (es. `redis://localhost:6379` o `rediss://...` per TLS).
- Tutte le istanze del backend devono usare lo **stesso Redis**.
- Gli eventi sono pubblicati sul canale Redis e ricevuti da tutte le istanze che hanno client connessi allo stream SSE.
- Dipendenza: `ioredis` (già in `package.json`).

## Deploy

- **Singola istanza**: non impostare `REALTIME_REDIS_URL`.
- **Più istanze (staging/produzione)**: configurare un Redis (es. Redis Cloud, ElastiCache, Redis in cluster) e impostare `REALTIME_REDIS_URL` in ogni istanza.
