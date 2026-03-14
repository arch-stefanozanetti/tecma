# Piano unificato CRM Millennium

**Riferimento:** piani prodotto/design per il CRM "nuovo millennio".  
**Relazione con il MASTER:** le wave 1–7 di [docs/FOLLOWUP_3_MASTER.md](../../docs/FOLLOWUP_3_MASTER.md) restano il riferimento di progetto; le wave Millennium sono un sottoinsieme di iniziative prodotto/UX (ricerca, inbox, customer 360, integrazioni/automazioni) e non le sostituiscono.

---

## Indice wave

| Wave | Nome                       | Obiettivo (una riga)                                        | FE           | BE           |
|------|----------------------------|-------------------------------------------------------------|--------------|--------------|
| 1    | Ricerca e preferenze UX   | Command Palette (Cmd+K) + persistenza sidebar               | Implementato | —            |
| 2    | Inbox                     | Notifiche e azioni in un unico punto                        | Implementato | Implementato |
| 3    | Customer 360              | Vista unificata cliente (timeline, trattative, calendario) | Implementato | —            |
| 4    | Integrazioni e automazioni| Regole, webhook, API pubbliche + pagina unica con 4 tab     | Implementato | Parziale     |

**Resta da fare:** Wave 4 backend: documentazione API pubbliche (OpenAPI) e autenticazione per uso esterno (API key/OAuth).

---

## Wave 1 — Ricerca globale e preferenze UX

### Obiettivo

- Ricerca unificata: navigazione tra sezioni + ricerca su entità (clienti, appartamenti, trattative) dalla Command Palette (Cmd/Ctrl+K).
- Preferenze UX: persistenza stato sidebar collapsed in `localStorage`.

### Ricerca globale (Command Palette)

- **Apertura:** Cmd+K (Mac) / Ctrl+K (Windows-Linux) da qualsiasi pagina (utente autenticato e in scope progetti).
- **Contenuto:**
  - **Sezione "Vai a":** comandi di navigazione (Home, Clienti, Appartamenti, Trattative, Calendario, Progetti, Report, ecc.) filtrati per query e feature.
  - **Sezioni entità** (quando c’è testo in ricerca): "Clienti", "Appartamenti", "Trattative" con fino a 5 risultati ciascuno da API (`queryClients`, `queryApartments`, `queryRequests` con `searchText` e `perPage: 5`).
- **Selezione:** comando "Vai a" → cambia sezione; entità cliente → `/clients/:clientId`; appartamento → `/apartments/:apartmentId`; trattativa → sezione requests (lista), stato opzionale `{ requestId }` per uso futuro. Chiusura: click fuori, Escape, o dopo selezione.
- **Dati e API:** contesto `workspaceId` e `selectedProjectIds` da project scope; `enabledFeatures` per nascondere sezioni non abilitate. Query entità: debounce 250 ms, tre chiamate in parallelo con `ListQuery` (workspaceId, projectIds, page: 1, perPage: 5, searchText). Stati: loading/errore non bloccante (mostrare solo sezioni disponibili).
- **Tipi:** `CommandSection` (kind, id Section, label, hint) allineato ad App/PageTemplate; `CommandEntity` (kind, type client|apartment|request, id, label, subtitle). Lista: prima "Vai a", poi gruppi Clienti / Appartamenti / Trattative.
- **UI e accessibilità:** freccia su/giù + Invio per selezione, Escape chiude, focus trap; autofocus input; `aria-label` "Ricerca globale", `role="listbox"` / `role="option"`, `aria-expanded` se combobox.
- **File:** CommandPalette.tsx (props workspaceId, projectIds, navigate; query con debounce; API; key down); Section type allineato (projects, integrations, priceAvailability dove mancano). App.tsx: stato commandPaletteOpen, useEffect Cmd/Ctrl+K, render CommandPalette dentro Router con isOpen, onClose, onSelectSection, navigate, workspaceId, projectIds, enabledFeatures.

### Preferenze utente (sidebar collapsed)

- **Scelta:** solo frontend con `localStorage`. Chiave: `followup.sidebarCollapsed` ("true" | "false"); opzionale `followup.sidebarCollapsed.${workspaceId}` per preferenza per workspace. Backend (UserPreferences.sidebarCollapsed) rinviato.
- **Comportamento:** lettura all’init di PageTemplate (default false se assente); scrittura a ogni toggle. PageTemplate.tsx: inizializzazione con `useState` che legge localStorage in try/catch; al toggle setState + scrittura in localStorage (o useEffect su sidebarCollapsed).

### Error handling e testing (sintesi)

- API entità: se una query fallisce, mostrare solo risultati disponibili; query vuota → solo "Vai a", nessuna chiamata entità. localStorage in try/catch (modalità privata); fallback sidebar aperta.
- Testing suggerito: CommandPalette (apertura/chiusura, filtro, selezione section/entità, tastiera, Escape); PageTemplate (toggle sidebar, lettura/scrittura localStorage).

### Deliverable Wave 1

1. Design doc (incluso in questo piano).
2. Command Palette estesa: ricerca entità, navigazione a dettaglio, tastiera e accessibilità, tipo Section allineato.
3. Persistenza stato sidebar collapsed in PageTemplate.
4. Integrazione in App con shortcut Cmd/Ctrl+K e props (workspaceId, projectIds, navigate, enabledFeatures).

---

## Wave 2 — Inbox

- **Obiettivo:** notifiche e azioni in un unico punto.
- **Stato:** implementato.
- **Implementazione:**
  - Componente **Inbox** ([core/shared/Inbox.tsx](../src/core/shared/Inbox.tsx)): icona campanella (Bell) nella header di PageTemplate; apertura Sheet laterale con elenco notifiche da `getNotifications(workspaceId, { read, page, perPage })`.
  - Badge con conteggio non lette; click su notifica → `navigate(link)` o `onSectionChange(link.section, link.state)`; segna come letta; pulsante "Segna tutti come letti".
  - Tipi notifica mostrati (request_action_due, calendar_reminder, assignment, mention, other). Le notifiche create dalle regole (Wave 4, tab Regole) arrivano qui quando il backend le persiste.
  - Inbox è reso in PageTemplate quando è disponibile `navigate` (header destra, accanto a Settings).

---

## Wave 3 — Customer 360

- **Obiettivo:** vista unificata sul cliente (timeline, trattative, calendario).
- **Stato:** implementato.
- **Implementazione:**
  - **Scheda cliente** ([core/clients/ClientDetailPage.tsx](../src/core/clients/ClientDetailPage.tsx)) = vista Customer 360: un unico punto per tutto ciò che riguarda il cliente.
  - **Tab Profilo:** contatti, profilazione, azioni rapide (mail ricevuta/inviata, chiamata, meeting), matching candidati.
  - **Tab Trattative:** lista trattative del cliente con stati e link a dettaglio.
  - **Tab Appartamenti:** appartamenti associati / di interesse.
  - **Tab Timeline:** timeline unificata (transizioni di stato trattative + azioni registrate + eventi calendario associati al cliente); CTA "Nuova azione", "Fissa in calendario" per riga e in cima; eventi calendario filtrati per `clientId`.
  - Accesso: da lista Clienti o da Command Palette (ricerca cliente → `/clients/:clientId`).

---

## Wave 4 — Integrazioni e automazioni

### Obiettivo

Regole "if this then that", webhook configurabili, API pubbliche documentate; una sola area "Integrazioni e automazioni" in UI con 4 tab (Connettori, Regole, Webhook, API).

### Relazione con altre wave

- **Wave 2 (Inbox):** le notifiche create dalle regole (tab Regole) compariranno in Inbox; indipendente a livello di implementazione.
- **Wave 3 (Customer 360):** nessun impatto.

### Backend

- **Automazioni:** modello `AutomationRule` (workspaceId, trigger con event_type e condizioni, azioni: create_notification, assign, webhook_call). Trigger: request status change, new client (estensibili). Azioni: crea notifica, chiamata webhook, assegnazione. UI: lista regole e form crea/modifica (placeholder se backend assente).
- **Webhook:** modello `WebhookConfig` (url, secret, eventi abilitati, workspaceId). Eventi: request.created, request.status_changed, client.created, ecc. Invio: coda asincrona, retry, firma payload con secret.
- **API pubbliche:** endpoint esistenti `POST /v1/apartments/query` (listing), `POST /v1/clients/lite/query` (lista light clienti). Autenticazione (API key o OAuth) da definire per connettori esterni. Documentazione OpenAPI/Swagger in arrivo.

### Frontend

- **Navigazione e route:** una sola voce di menu in Strumenti: "Integrazioni e automazioni" (section id `integrations`). Route: `/integrations`. Tab attivo: `?tab=connettori|regole|webhook|api` (default `connettori`). Redirect `/automations` → `/integrations?tab=regole`. Rimozione section `automations` e voce "Automazioni e API" dal menu e dalla Command Palette.
- **Tab:**

| Tab          | Contenuto |
|--------------|-----------|
| Connettori   | Catalogo connettori (IntegrationsPage): ricerca, filtri, card, toggle configura. |
| Regole       | Lista regole if/then (placeholder se backend assente), CTA "Nuova regola", breve descrizione. |
| Webhook      | Lista webhook (placeholder), CTA "Aggiungi webhook", descrizione e campi (URL, secret, eventi). |
| API          | Testo su API pubbliche, endpoint (apartments/query, clients/lite/query), link a docs. |

- **UX:** tab bar sotto il titolo; stato attivo sincronizzato con `?tab=`; primo accesso senza tab → Connettori. Accessibilità: tab da tastiera, `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`.
- **Implementazione:** unico componente pagina che legge `searchParams.get("tab")` e renderizza i 4 tab; Connettori = contenuto attuale IntegrationsPage (sottocomponente o inline). Menu: una voce "Integrazioni e automazioni", id `integrations`; rimuovere nav item `automations`. App: rimuovere section `automations`, route `/automations` → redirect `/integrations?tab=regole`.

### Stato Wave 4

- **Frontend:** implementato. Pagina unica Integrazioni con 4 tab (Connettori, Regole, Webhook, API); tab Regole e Webhook con CRUD e integrazione alle API backend; Connettori = catalogo; tab API = testo e link a docs.
- **Backend:** implementato per automazioni e webhook:
  - **AutomationRule** (collection `tz_automation_rules`): CRUD, list by workspace; trigger (request.created, request.status_changed, client.created, con toStatus opzionale); azioni create_notification e webhook_call.
  - **WebhookConfig** (collection `tz_webhook_configs`): CRUD, list by workspace; url, secret, eventi abilitati.
  - **Invio eventi:** `dispatchEvent(workspaceId, eventType, payload)` invocato su creazione cliente, creazione richiesta e cambio stato richiesta; esegue regole abilitate (notifiche in `tz_notifications`) e invio webhook.
  - **Webhook delivery:** POST al URL configurato con retry, firma HMAC su body (X-Webhook-Signature: sha256=...).
- **Resta da fare (Wave 4 backend):** documentazione API pubbliche (OpenAPI/Swagger) per endpoint esistenti (apartments/query, clients/lite/query); autenticazione per uso esterno (API key o OAuth) da definire.

---

## Stato e prossimi passi

- **Wave 1 (FE):** implementato. Command Palette con ricerca entità (clienti, appartamenti, trattative), shortcut Cmd/Ctrl+K, preferenze sidebar in localStorage.
- **Wave 2 (FE + BE):** implementato. Inbox in header, Sheet notifiche, navigazione da link, segna letti; backend notifiche (get, mark read, read-all).
- **Wave 3 (FE):** implementato. ClientDetailPage con tab Profilo, Trattative, Appartamenti, Timeline unificata e eventi calendario.
- **Wave 4 (FE):** implementato. Pagina unica Integrazioni con 4 tab (Connettori, Regole, Webhook, API), redirect `/automations` → `/integrations?tab=regole`, CRUD regole e webhook collegato al backend.
- **Wave 4 (BE):** implementato per automazioni e webhook (AutomationRule, WebhookConfig, dispatchEvent su client/request, invio webhook con retry e firma). **Resta:** documentazione API pubbliche (OpenAPI) e autenticazione per uso esterno (API key/OAuth).
