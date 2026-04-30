# UX Rules — App Interna + Portale Cliente

## Obiettivo
Uniformare esperienza tra backoffice agente e portale cliente con primitive DS condivise.

## Regole vincolanti
- Usare solo componenti DS (`Button`, `Input`, `Card`, `Select`, `SidePanel`, `Sheet`, `Drawer`) in entrambe le superfici.
- Stati visuali coerenti: `loading`, `empty`, `error`, `success` con copy breve e azione primaria.
- Typography e spacing guidati da token (`font-body`, `rounded-ui`, scale `text-*`, `px/py` standard).
- Focus/keyboard obbligatori su mobile e desktop (`focus-visible`, tab order lineare, ESC su pannelli).

## Journey mobile critici
- Login: CTA unica sopra la fold, errori inline leggibili.
- Agenda (`calendar`): accesso in 1 tap da quick nav mobile.
- Follow-up (`requests`): transizioni stato sempre raggiungibili da mobile.
- Stato trattativa/unità: scorciatoia rapida a `apartments` da bottom quick nav.

## PWA & Offline
- Banner rete condiviso tra app interna e portale.
- Prompt installazione PWA non invasivo, dismissabile.
- In offline, degradare in sola lettura ove possibile e segnalare sync pending.

