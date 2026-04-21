# ZEUS POC — Runbook operativo

ZEUS è l’assistente AI omnicanale (telefono, WhatsApp, email) in FollowUp 3.0. Questo documento descrive come collegare **numero Twilio**, **WhatsApp** e **inbound email** e verificare che risponda.

**Strategia voce Track A / Track B** (architettura, migrazione, pricing di massima): vedi [ZEUS_VOICE_TRACK_AB.md](./ZEUS_VOICE_TRACK_AB.md).

## Twilio è obbligatorio?

**No, non in assoluto** — dipende dal canale:

| Canale | Serve un “terzo”? | Note |
|--------|-------------------|------|
| **Email (prodotto)** | **Host della casella del cliente** — percorso consigliato: **Microsoft Graph** / **Gmail API** / **IMAP** (es. Aruba, server dedicati). **Non** è richiesto un SaaS tipo SendGrid/Mailgun solo per fare da ponte HTTP. |
| **Email (POC tecnico)** | Opzionale | Esiste ancora un endpoint **POST** `.../zeus/webhooks/email` per payload normalizzati (test o integrazioni custom), **non** come percorso utente standard rispetto alla lettura da casella. |
| **Voce (PSTN)** | **Sì, un operatore telefonico** — il CRM non può agganciare il numero mobile fisso senza passare da un **carrier o CPaaS** (Twilio, Vonage, MessageBird, AWS Connect, ecc.). Non è “Twilio o niente”, ma serve **qualcuno** con interconnessione alla rete telefonica. La risposta vocale nel POC usa **TTS integrato** del provider (es. Twilio `<Say>`); voci premium (ElevenLabs, ecc.) sono evoluzioni facoltative. |
| **WhatsApp** | **Sì, l’ecosistema Meta** — messaggi ufficiali passano dalla **WhatsApp Business API** (diretta o tramite Twilio, 360dialog, MessageBird, ecc.). Non è possibile evitare un provider certificato se vuoi WA su numeri business. |

Il codice POC attuale integra **Twilio** per Voice + WhatsApp perché unifica firma, webhook e invio in un solo adapter. In evoluzione si possono aggiungere **adapter** (es. Meta Cloud API per WA, altro CPaaS per voce) dietro gli stessi endpoint logici, senza obbligo di Twilio.

## Prerequisiti

1. **Backend** raggiungibile via **HTTPS** pubblico (es. Render: `https://followup-3-be.onrender.com`).
2. **Variabili ambiente backend** utili:
   - `API_BACKEND_PUBLIC_URL` — URL base del backend **senza** path finale (es. `https://followup-3-be.onrender.com`). Serve alla UI per mostrare gli URL webhook completi nella risposta `GET .../zeus/poc-config`.
   - `ZEUS_TWILIO_ACCOUNT_SID` / `ZEUS_TWILIO_AUTH_TOKEN` — opzionali: fallback globale se non salvi SID/token nel workspace (`PATCH .../zeus/poc-config`).
   - `ZEUS_TWILIO_SKIP_SIGNATURE=true` — solo in dev: disattiva la verifica `X-Twilio-Signature` (es. tunnel ngrok con URL che non coincide con la Console Twilio).
3. **Configurazione AI workspace** (Integrazioni → Connettori): provider + API key (`tz_workspace_ai_config`). Senza di essa ZEUS risponde con messaggio statico.
4. Nel portale: **Integrazioni → ZEUS**, workspace corretto. Salva Twilio SID/token e il **WhatsApp From** (es. sandbox `whatsapp:+14155238886`). Usa **Inizializza segreto email** se serve un segreto per il webhook email.

## URL webhook (da incollare nei provider)

Sostituisci `<WORKSPACE_ID>` e l’host del backend:

| Uso | Metodo | Path |
|-----|--------|------|
| Twilio Voice | `POST` | `https://<BACKEND>/v1/workspaces/<WORKSPACE_ID>/zeus/webhooks/twilio/voice` |
| Twilio WhatsApp | `POST` | `https://<BACKEND>/v1/workspaces/<WORKSPACE_ID>/zeus/webhooks/twilio/whatsapp` |
| SIP Voice (Track B, stub) | `POST` | `https://<BACKEND>/v1/workspaces/<WORKSPACE_ID>/zeus/webhooks/sip/voice` — oggi risponde **501** finché il gateway non è implementato |
| Email inbound | `POST` | `https://<BACKEND>/v1/workspaces/<WORKSPACE_ID>/zeus/webhooks/email?secret=<SEGRETO>` |

Il **segreto email** è in `PATCH .../zeus/poc-config` (campo mascherato) oppure dopo “Inizializza segreto email”. Puoi anche passare il segreto nell’header `x-zeus-email-secret`.

## Twilio — Voice

1. Twilio Console → Phone Numbers → il tuo numero → **Voice & Fax**: **A CALL COMES IN** → Webhook `POST` → incolla l’URL Voice sopra.
2. Chiama il numero: sentirai il prompt Zeus; parla dopo il segnale. La trascrizione viene inviata al LLM; la risposta è letta via `<Say>`.

## Twilio — WhatsApp (sandbox o numero approvato)

1. Twilio → Messaging → Try it out / Senders → configura il sender WhatsApp.
2. **When a message comes in**: Webhook `POST` → URL WhatsApp sopra.
3. Imposta nel CRM **WhatsApp From** uguale al sender (es. `whatsapp:+14155238886`).
4. Invia un messaggio dal telefono collegato alla sandbox: la risposta parte via API Twilio Messages.

## Email — modello prodotto (priorità)

1. **Lettura dalla casella del cliente** (roadmap / integrazioni Connettori): **Outlook / Microsoft 365** (Graph), **Google / Gmail** (API), **IMAP** generico per provider come **Aruba** o mail su server dedicato — **senza** obbligo di un vendor email intermedio.
2. **SMTP di invio** per le risposte: come il resto dell’app (`EMAIL_TRANSPORT` / `SES_SMTP_*` / `EMAIL_FROM`). In `mock` le risposte finiscono nel log mock.

## Email inbound — webhook HTTP (solo tecnico / POC)

Per test o integrazioni che inviano già un POST normalizzato:

- URL: `.../zeus/webhooks/email?secret=<SEGRETO>` oppure header `x-zeus-email-secret`.
- Body attesi: JSON `{ "from", "subject", "text" }` oppure form fields `from`, `subject`, `text` / `body`.

Questo **non** sostituisce la lettura da casella IMAP/API descritta sopra come percorso principale di prodotto.

## Verifica

- Tab **Integrazioni → ZEUS**: tabella **Ultimi turni** dopo chiamata/messaggio/email.
- Log backend: prefisso `[zeus]`.

## Sicurezza produzione

- Non usare `ZEUS_TWILIO_SKIP_SIGNATURE` in produzione.
- Preferire credenziali Twilio in `PATCH` workspace o in secret manager, non in chiaro nel repo.
