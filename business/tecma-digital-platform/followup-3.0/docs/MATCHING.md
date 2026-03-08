# Matching domanda/offerta (punto 6.2)

## Obiettivo

- In **pagina Appartamento**: lista "Clienti papabili" (con score).
- In **pagina Cliente**: lista "Appartamenti papabili" (con score).
- **Pagina dedicata "Matching"** con vista unificata.

Profilazione su cliente e appartamento (prezzo, zona, tipologia, budget, preferenze); score in base al match.

## Stato

L’implementazione dettagliata (endpoint, algoritmo di scoring, componenti FE) andrà completata quando sarà disponibile il **codice di esempio** backend + frontend citato nel piano.

## Dove collocare l’implementazione

- **Backend:** endpoint es. `GET /v1/matching/apartments/:id/candidates`, `GET /v1/matching/clients/:id/candidates`, eventuale `POST /v1/matching/query` per la pagina dedicata; algoritmo di scoring basato sui campi di profilazione (allineati a CLIENT_APARTMENT_MODEL.md e al punto 2.2).
- **Frontend:** solo design system esistente (componenti `fe-followup-v3/src/components/ui/`, Tailwind): liste "papabili" in ClientDetailPage e ApartmentDetailPage, più pagina Matching (route e layout).
- **Modello:** i campi di profilazione da aggiungere a cliente e appartamento (punto 2.2) saranno gli stessi usati per il calcolo del matching.
