# ZEUS voce: Track A vs Track B e migrazione senza spreco

## Sintesi (stato aggiornato)

| | Track A (oggi in prodotto) | Track B (roadmap) |
|---|---------------------------|-------------------|
| Ingresso PSTN | CPaaS (Twilio) + webhook | SIP / Voice Gateway + carrier (es. Messagenet, CloudItalia) |
| Time to market | Settimane | Mesi |
| Valore per il cliente | Prompt, CRM, inbox turni, analytics | Stesso dominio; margine e controllo infrastruttura maggiori |

Il **vantaggio competitivo** è cosa dice l’agente e quando (`runZeusTurn`, policy, integrazioni CRM), non il solo possesso di SIP.

## Cosa non buttare passando da A a B

- **Pipeline AI**: `runZeusTurn` in `be-followup-v3/src/core/zeus/zeus-orchestrator.service.ts`.
- **Persistenza**: turni `tz_zeus_turns` con `externalId` (CallSid o id gateway); opzionale `ingressProvider` (`twilio` | `sip_gateway`).
- **UI**: registro turni e statistiche (`GET .../zeus/turns`, `.../zeus/turns/stats`) — già suddivise per canale (`voice`).
- **Solo da sostituire**: adapter tra rete telefonica e testo (STT/TwiML o stream SIP).

## Confine codice (adapter) — implementato

- **Tipi**: `be-followup-v3/src/core/zeus/zeus-voice-ingress.types.ts` (`VoiceIngressEvent`, `externalCallId` concettuale).
- **Dominio voce**: `zeus-voice-turn.service.ts` — `runVoiceIngressPipeline` (insert → LLM → insert + log metrica `zeus_voice_turn`).
- **Track A**: `twilio-voice-ingress.service.ts` — parsing Twilio, TwiML, TTS.
- **Track B (SIP live)**: `sip-voice-ingress.service.ts`; endpoint `POST .../zeus/webhooks/sip/voice` valida secret/IP + firma anti-replay e invoca la stessa pipeline dominio.
- **Audio URL provider-agnostic**: endpoint `GET .../zeus/webhooks/voice-audio/:audioId` per gateway che riproducono da URL.

## Sicurezza Track B (SIP)

- Secret richiesto: `ZEUS_SIP_WEBHOOK_SECRET` (Bearer o `x-zeus-sip-secret`).
- Anti-replay obbligatorio: `x-zeus-sip-ts` + `x-zeus-sip-signature` (HMAC SHA256 su `<timestamp>.<body_json_canonico>`, finestra 5 minuti).
- Allowlist opzionale: `ZEUS_SIP_ALLOWED_CIDRS` (IPv4/IPv6, CIDR supportato).
- Dev-only bypass: `ZEUS_SIP_SKIP_SIGNATURE=true`.
- Rate limit dedicato webhook ZEUS (`zeusWebhookRateLimiter`) su Twilio/SIP.

## Config workspace

- `voiceIngressProvider` in `PATCH .../zeus/poc-config`: `twilio` (default) o `sip_gateway` (intento futuro; il traffico Twilio resta disponibile per migrazione graduale).

## Osservabilità (MVP Track A)

I log strutturati includono `event: "zeus_voice_turn"`, `voiceIngressProvider`, `externalCallId`, `llmFailed`, conteggi utili per dashboard e pricing a consumo.

Le statistiche aggregate per canale voce sono già disponibili via `GET .../zeus/turns/stats` (campo `byChannel.voice`).

## Pricing / messaggio commerciale (indicazioni)

- **Track A**: posizionare come “assistente telefonico + CRM” (operatore PSTN sotto, white-label sul flusso utente); fascia indicativa 99–299 €/mese + minuti inclusi e overage — da allineare a commerciale/controlling.
- **Track B**: narrativa “infrastruttura dedicata” solo quando il gateway SIP è in produzione stabile.

## Riferimenti

- Runbook operativo: [ZEUS_POC_RUNBOOK.md](./ZEUS_POC_RUNBOOK.md).
