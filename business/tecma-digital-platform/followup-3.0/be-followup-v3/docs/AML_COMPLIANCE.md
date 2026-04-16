# AML / KYC — Ruoli e responsabilità (FollowUp 3.0)

Questo documento descrive il **posizionamento di prodotto** dell’integrazione con provider esterni (es. Sumsub) per verifiche AML/KYC. **Non costituisce parere legale**: il cliente finale deve rivolgersi al proprio consulente per obblighi di antiriciclaggio, settore e territorio.

## Ruolo della piattaforma Tecma / FollowUp

- FollowUp agisce come **facilitatore tecnico**: orchestrazione di verifiche tramite API di terze parti, persistenza di stati e riferimenti necessari al workflow CRM/contrattuale.
- **Non** sostituisce il compliance officer né il soggetto obbligato: dove la normativa impone procedure AML al cliente (agenzia, fondo, costruttore), **resta responsabilità del cliente** definire policy, conservazione documentale, segnalazioni e audit interni.

## Dati personali e conservazione

- I dati identificativi e i documenti possono essere trattati dal **provider** scelto (DPA con Sumsub o altro) e, in misura minima, da FollowUp per collegare cliente ↔ stato verifica (metadata, ID applicant, esito normalizzato).
- Retention e basi giuridiche vanno allineate alla **privacy policy** del workspace e, ove necessario, a una valutazione d’impatto (DPIA) lato cliente.

## Gate contrattuali (configurabile)

- Il prodotto può esporre policy tipo `amlRequiredAt` (es. solo in fase contrattuale): la logica di blocco/sblocco va definita in implementazione business e non anticipa automaticamente la conformità normativa.

## Webhook e audit

- Gli esiti ricevuti via webhook aggiornano stati interni e devono essere tracciati per **revisione operativa** (chi ha avviato la verifica, timestamp, esito). Non costituiscono di per sé prova legale autonoma senza il pacchetto reso disponibile dal provider secondo i termini di servizio.

## Aggiornamenti

- In caso di cambio fornitore o ambito normativo, aggiornare questo documento e i termini contrattuali con i clienti SaaS.
