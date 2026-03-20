# MessagingGateway (rollout pragmatico)

## Obiettivo

Introdurre un livello applicativo unico per invio messaggi che riduce lock-in e separa la logica di dominio dai provider esterni.

## Livelli

- Livello base: routing standard e provider primario per canale.
- Livello connettore: capability avanzate (fallback multi-provider) governate da feature flag.

## Routing attuale

- SMS: provider primario `aws_sms`.
- WhatsApp: provider primario `twilio`.
- Fallback Twilio su SMS: previsto ma disattivato di default (`MESSAGE_TWILIO_FALLBACK_ENABLED=false`).

## Contratto

`MessagingGateway` riceve una richiesta uniforme (`workspaceId`, `channel`, `to`, `body`) e ritorna `DeliveryResult` con:

- provider usato
- stato (`queued` / `sent` / `failed`)
- eventuale errore normalizzato (`RateLimited`, `ProviderUnavailable`, ecc.)

## Osservabilita minima

Ogni invio traccia:

- `workspaceId`
- `channel`
- `provider`
- `latencyMs`
- esito

## Fase successiva

Abilitazione fallback per tenant solo dopo introduzione governance admin (ruolo Tecma) con audit trail.

