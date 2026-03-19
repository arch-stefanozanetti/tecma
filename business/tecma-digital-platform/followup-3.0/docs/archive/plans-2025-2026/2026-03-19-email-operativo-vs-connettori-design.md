# Email operative vs connettori — confine e mappa eventi

**Data:** 2026-03-19  
**Stato:** design approvato

---

## 1. Confine: Followup vs mail marketing

| In Followup (resta così) | Meglio su connettore (n8n, SES+campagne, Mailchimp, Customer.io, …) |
|--------------------------|---------------------------------------------------------------------|
| Mail **transazionali** legate a un’azione utente o a uno stato business chiaro (invito, reset, conferma, “sei stato assegnato”, “cambio stato trattativa”) | Newsletter, A/B test, segmenti dinamici, unsubscribe legali, deliverability di massa |
| Template con **variabili** e aspetto brand (logo/colore) per canale **operativo** | Orchestrazione multi-step, scoring lead, remarketing |

**Copy da UI (suggerito):**  
*“Questa sezione serve a personalizzare le email operative dell’app. Per campagne, liste e automazioni di marketing collega un connettore (es. n8n, provider esterno) dalla pagina Integrazioni.”*

---

## 2. Mappa eventi candidati (priorità MoSCoW)

| Area | Esempio evento | Mail in-app vs connettore | Priorità |
|------|----------------|---------------------------|----------|
| **Identity** | Invito, reset, verifica | Già in-app; restano transazionali | Done |
| **Trattative (request)** | Cambio stato, assegnazione owner, promemoria scadenza | Forte candidato in-app; mail se regola workspace/progetto | **Should** |
| **Matching** | Nuovi candidati sopra soglia score, “match trovato” per appartamento/cliente | Candidato **opzionale** (rumore alto → meglio digest o solo in-app) | **Could** |
| **Calendario** | Promemoria appuntamento, invito ICS | Spesso meglio calendario esterno; mail opzionale | Could |
| **Clienti** | Nuovo lead, completamento profilazione | Regole comunicazione esistenti | Should |
| **Import / batch** | Import Excel completato / errori | Utile per admin; bassa frequenza | Could |
| **Sicurezza** | Login da nuovo device, cambio password | Transazionale; priorità media | Could |
| **Digest** | Riassunto settimanale pipeline | Più da connettore o job schedulato | Won’t (connettore) |

### Matching automatico

Ha senso una mail solo se il prodotto definisce **soglia**, **frequenza** (es. max 1 digest/giorno) e **destinatario** (agente assegnato vs admin). Altrimenti rischio spam; alternativa solida: **notifica in-app** + opzione “invia anche email” a livello progetto.

---

## 3. Scope: workspace vs progetto

Modello coerente per il futuro:

- **Globale app (raro):** solo invito/reset/verifica (identità).
- **Workspace:** default brand e template per tutti i progetti del workspace.
- **Progetto:** override logo/colori/template per quel progetto.

UI: stessa pagina “Email” con tab **Globale | Workspace | Progetto** (progetto = select dopo workspace).

---

## 4. Stato implementazione

- **Editor a blocchi + palette placeholder:** implementati (TipTap, drag `{{projectName}}` ecc., commit `a32f543`). **Spike completato** — editor ricco (grassetto, H1–H3, elenchi, sottolineato), palette laterale drag-and-drop, logo/colore primario, upload S3 opzionale, HTML sanitizzato lato server.
- **Scope workspace/progetto:** da implementare (estensione schema `tz_email_flows` con `scope`, `workspaceId`, `projectId`).
- **Nuovi flussi (trattative, matching, …):** da valutare dopo scope.
