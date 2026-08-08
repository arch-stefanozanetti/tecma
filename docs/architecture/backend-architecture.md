# Architettura del backend Followup 3.1

Documento di riferimento per la review architetturale. Risponde a tre domande:
com'e' fatto, perche' e' fatto cosi', quando va cambiato.

## 1. Forma attuale

Monorepo pnpm con **un solo servizio deployabile** e cinque librerie interne.

```text
backend/
  packages/
    shared-types     tipi di dominio condivisi
    shared-config    caricamento e validazione env (loadEnv -> AppConfig)
    shared-rbac      catalogo permessi e valutazione ruoli
    logger           logger strutturato con bindings di richiesta
    db               client Mongo, indici, repository di base, audit append-only
  services/
    api/             servizio Fastify (web) + worker (job), stesso codice
      src/
        modules/     12 domini: admin apartments assets audit auth i18n mail
                     projects rbac requests users workspaces
        plugins/     security (helmet/CORS/rate limit) apiKey jwt permission
        infra/       observability, request context, coda dei job
        lib/         utility trasversali (errori, paginazione, appEnv, ...)
        schemas/     schemi condivisi + generazione OpenAPI
        jobs/        handler eseguiti dal worker
      tests/         unit, integration, contract (OpenAPI)
```

Deploy: due processi Render dallo stesso repository e dalla stessa build.

```text
           HTTP                             coda tz_jobs (Mongo)
 browser --------> [ web: node dist/server.js ] --------------------> [ worker: node dist/worker.js ]
                              |                                                    |
                              +---------------- MongoDB test-zanetti --------------+
```

## 2. Perche' monorepo

Con un solo servizio deployabile il monorepo non ha costi e ha benefici concreti:

- tipi condivisi tra API e librerie senza pubblicare pacchetti su un registry;
- un lockfile, una pipeline, una versione di TypeScript;
- refactor atomici: cambiare un tipo in `shared-types` e adeguare l'API e' un solo commit;
- l'OpenAPI e' generata dallo stesso codice che serve le rotte, quindi non puo' divergere.

La separazione in `packages/` non e' cosmetica: impedisce all'API di diventare un
blocco unico e definisce in anticipo le linee di taglio per un'eventuale estrazione.

## 3. Perche' non microservizi (ancora)

Il costo dei microservizi si paga subito, il beneficio arriva solo con condizioni
che oggi non ci sono: team separati con cicli di rilascio indipendenti, profili di
carico divergenti, requisiti di isolamento normativo.

Spezzare adesso significherebbe: transazioni distribuite su Mongo, latenza di rete
tra chiamate oggi in-process, 5 pipeline invece di 1, tracing obbligatorio per
capire un errore. In cambio di nulla.

La scelta e' **monolite modulare**: confini interni netti, un solo deploy.

### Criteri di estrazione

Un modulo esce dal monolite quando **almeno due** di queste condizioni sono vere:

1. il suo profilo di carico e' incompatibile con quello dell'API (picchi a raffica,
   job lunghi, memoria molto diversa);
2. richiede una cadenza di rilascio propria o un team dedicato;
3. e' causa ricorrente di incidenti che degradano rotte non correlate;
4. ha bisogno di scalare su una dimensione diversa (es. CPU-bound contro IO-bound).

Ordine dei candidati, oggi: **ingestion/ETL Big Data**, poi i **job schedulati**
(retention, sync calendari). L'API CRUD resta dov'e'.

La separazione web/worker gia' introdotta e' il primo passo di questa scala: e'
separazione di processo, non ancora un servizio autonomo, e copre il 90% del
beneficio a una frazione del costo.

## 4. Confini interni

Regola: un modulo di dominio non importa l'interno di un altro modulo. Il codice
condiviso sale in `lib/`, `infra/` o in un pacchetto `@followup/*`.

La regola e' applicata da ESLint (`no-restricted-imports` in `eslint.config.js`),
non lasciata alla disciplina. Le eccezioni note sono elencate esplicitamente nel
file, cosi' ogni nuova eccezione e' visibile in review.

### Mappa modulo -> collection principali

| Modulo            | Collection Mongo                                |
| ----------------- | ----------------------------------------------- |
| auth              | `tz_users`, `tz_sessions`, `tz_audit_events`    |
| users             | `tz_users`, `tz_user_roles`                     |
| rbac              | `tz_roles`, `tz_user_roles`                     |
| workspaces        | `tz_workspaces`, `tz_workspace_members`         |
| projects          | `tz_projects`, `tz_project_access`              |
| apartments        | `tz_apartments`, listini e calendari prezzi     |
| requests          | `tz_requests`                                   |
| assets            | `tz_assets`                                     |
| i18n              | `tz_i18n_bundles`                               |
| mail              | `tz_email_flows`                                |
| audit             | `tz_audit_events` (append-only)                 |
| admin             | lettura trasversale, nessuna collection propria |
| infra/jobQueue    | `tz_jobs`                                       |
| plugins/rateLimit | `tz_rate_limit`                                 |

## 5. Scalabilita'

Il servizio web e' **stateless**: autenticazione via JWT, nessuna sessione in
memoria, nessun file locale nel percorso di richiesta. Puo' quindi essere replicato
orizzontalmente. I due punti che lo impedivano sono stati chiusi:

- **Rate limit condiviso.** I contatori vivono su Mongo (`tz_rate_limit`, con TTL),
  non nella memoria del processo: con N istanze il limite resta quello dichiarato
  invece di moltiplicarsi per N. In caso di indisponibilita' del database lo store
  e' fail-open, perche' una protezione non deve diventare un single point of failure.
- **Lavoro pesante fuori dal percorso di richiesta.** I job vanno sulla coda
  `tz_jobs` e li esegue il processo worker.

### Coda dei job

Semantica **at-least-once** con lease a scadenza: se un worker muore, il job torna
prelevabile invece di restare bloccato. Di conseguenza **gli handler devono essere
idempotenti**. Ritentativi con backoff esponenziale, poi stato `failed` per
ispezione manuale. Deduplica opzionale tramite `dedupeKey` per i job periodici.

Mongo e non Redis: il volume non giustifica un componente in piu', e Mongo e' gia'
critico. Se la coda diventa il collo di bottiglia, l'interfaccia `JobQueue` e' il
punto unico da riscrivere.

### Ambienti prod e demo

`prod` e `demo` convivono nello stesso processo: l'header `x-app-env` seleziona la
connessione per singola richiesta. E' la parte piu' delicata del sistema, quindi la
logica e' isolata in `lib/appEnv.ts` e coperta da test: il default e' sempre `prod`
e solo il valore esatto `demo` cambia database, cosi' un header malformato non puo'
far comparire dati demo su un'installazione reale.

## 6. Cosa misuriamo

`pnpm perf:workspace:baseline` produce p50/p95/p99, throughput ed errori per rotta,
in JSON per la CI e in tabella markdown per la review
(`services/api/security-reports/workspace-load-baseline.*`).
Va rieseguito prima di ogni cambio di dimensionamento su Render.

## 7. Qualita' in CI

Ogni push esegue, in quest'ordine: install, build dei pacchetti condivisi, lint
(inclusa la regola sui confini tra moduli), typecheck, test unitari, build,
format check. I test di contratto verificano che l'OpenAPI generata resti valida e
coerente con le rotte registrate.

## 8. Debito noto

- Nessuno scheduler: i job periodici vanno accodati da un cron esterno che chiama
  un endpoint interno, oppure da un ciclo nel worker. Da decidere alla prima
  necessita' reale.
- Ingestion Big Data ancora lato frontend: l'handler `bigdata.ingest` esiste come
  punto di atterraggio, la logica va spostata quando si migra quella parte.
- Tracing distribuito limitato al `traceId` di richiesta; sufficiente con un solo
  servizio, da estendere alla prima estrazione.
