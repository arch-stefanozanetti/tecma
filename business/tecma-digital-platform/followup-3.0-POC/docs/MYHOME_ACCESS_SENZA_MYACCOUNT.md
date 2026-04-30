# Accedere al nuovo MyHome senza passare da MyAccount

Analisi della codebase **fe-tecma-myhome** e flusso di auth per capire come aprire direttamente un URL tipo:

`https://mh-demo.tecmasolutions.com/?projectId=69aead6a3a69563a3d2d3406&locale=it-IT`

## Flusso attuale di MyHome

1. **Host e project info**
   - L’app usa `DetectUrl()` per ottenere l’host (es. `mh-demo.tecmasolutions.com`).
   - Chiama **`GET /api/v1/projects/by-host?host=<host>`** con `credentials: 'include'` (cookies inviati).
   - La risposta viene usata in `setAssetsByObject(project)` e imposta `store.projectId = obj.id`.
   - **Nota:** i parametri `projectId` e `locale` in query string **non** sono usati dall’app per risolvere il progetto; il progetto viene sempre risolto tramite **by-host** in base all’host.

2. **Autenticazione**
   - `JwtChecker` chiama **getUserByJWT** (GraphQL) con `store.projectId`.
   - Il JWT non viene letto da header o da query: le richieste usano **cookie** (`credentials: 'include'`).
   - I cookie sono gestiti in `CookieUtils.jsx` (js-cookie) con dominio derivato da `psl.parse(hostname).domain` (es. `.tecmasolutions.com`).

## Cookie necessari (stesso formato di MyAccount)

Per essere riconosciuto come utente loggato, il browser deve inviare questi cookie sul dominio dell’host MyHome (o sul dominio padre condiviso):

| Cookie        | Chiave        | Uso                    |
|---------------|---------------|------------------------|
| JWT           | `jwt`         | Token di accesso        |
| Refresh token | `refreshToken`| Refresh sessione       |
| Scadenza      | `expiresIn`   | Scadenza token         |
| Client (opz.) | `clientId`    | Se ruolo client        |

- Su **localhost** il dominio cookie è `localhost`.
- Su **mh-demo.tecmasolutions.com** il dominio è `.tecmasolutions.com` (così il cookie è inviato a tutti i sottodomini tecmasolutions.com).

MyAccount, al login, imposta questi stessi cookie sul dominio della piattaforma; per questo “passando da MyAccount” funziona.

## Come entrare senza passare da MyAccount

### Opzione 1: Cookie già presenti (hai già fatto login da MyAccount)

- Fai **una volta** login da MyAccount (stesso dominio, es. businessplatform o myaccount su tecmasolutions.com).
- Poi apri direttamente:  
  `https://mh-demo.tecmasolutions.com/?projectId=69aead6a3a69563a3d2d3406&locale=it-IT`
- Se i cookie sono impostati per `.tecmasolutions.com`, il browser li invia a `mh-demo.tecmasolutions.com` e MyHome ti considera loggato (a patto che by-host restituisca il progetto).

### Opzione 2: Impostare i cookie a mano (es. per test)

Solo per ambienti di test, puoi impostare i cookie nel browser (DevTools → Application → Cookies) per il dominio usato da MyHome:

- **Nome:** `jwt`  
  **Valore:** `<access_token_valido>`
- **Nome:** `refreshToken`  
  **Valore:** `<refresh_token_valido>`
- **Dominio:**  
  - per **mh-demo.tecmasolutions.com** → `.tecmasolutions.com`  
  - per **localhost** → `localhost`

L’access token e il refresh token vanno ottenuti da un login reale (es. da MyAccount o da un endpoint di login che emette gli stessi token).

### Opzione 3: Localhost / sviluppo

- In **DetectUrl.jsx** in modalità “legacy dev” (`isLegacyDevMode()`: localhost, .ddns.net, biz-tecma, -demo.tecmasolutions.com) l’host può essere **sovrascritto** con il query param **`hostname`**:
  - Es.:  
    `http://localhost:3000/?hostname=www.tuosito-progetto.it`
  - L’app salva `hostname` in `localStorage` come `myhome_dev_hostname` e lo usa per la chiamata **by-host**.
- Per avere progetto e auth in locale:
  1. Usa `?hostname=...` (o localStorage `myhome_dev_hostname`) in modo che by-host risolva il progetto (il backend deve conoscere quell’host).
  2. Aggiungi i cookie `jwt` e `refreshToken` (e se serve `clientId`) per il dominio `localhost` (o il dominio su cui gira l’app in locale).

## Backend: by-host e progetto demo

- L’endpoint **`GET /api/v1/projects/by-host`** (es. in `be-tecma-graphql`, `restV1.js`) deve avere una regola che per **host = mh-demo.tecmasolutions.com** restituisce il progetto con id `69aead6a3a69563a3d2d3406` (o l’id corretto per l’ambiente demo).
- Se by-host non restituisce quel progetto per quell’host, MyHome non potrà caricare il contesto progetto correttamente anche con i cookie giusti.

## Riepilogo pratico

| Obiettivo                         | Cosa fare |
|----------------------------------|-----------|
| Entrare su mh-demo **senza** MyAccount | Avere i cookie `jwt` (e `refreshToken`, eventualmente `clientId`) impostati per `.tecmasolutions.com` (es. dopo un login MyAccount precedente, o impostandoli a mano per test). |
| Localhost                        | Usare `?hostname=...` (o `myhome_dev_hostname` in localStorage) e cookie su `localhost`. |
| Parametri in URL                 | `projectId` e `locale` nell’URL **non** vengono usati per risolvere il progetto; il progetto è dato solo da **by-host** in base all’host. Per usare direttamente il `projectId` in URL servirebbe una modifica in fe-tecma-myhome (es. in `projectInfo.js` o in uno step prima di `setAssetsByObject`). |

Se vuoi, il passo successivo può essere: (1) verificare in be-tecma che by-host per `mh-demo.tecmasolutions.com` restituisca il progetto demo, e (2) eventuale modifica in fe-tecma-myhome per supportare `?projectId=...` come fallback quando by-host non è disponibile o per deep link.
