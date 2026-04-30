# Regole editoriali — campo `summary` (Product Blueprint / catalogo)

Obiettivo: in **Panoramica** si capisce in pochi secondi *cosa fa* la capability senza aprire il PRD completo.

## Regole

1. **Lunghezza**: una o due frasi (circa **120–240 caratteri**); massimo 280 caratteri salvo eccezione documentata.
2. **Prima lettura**: inizia con **cosa fa il sistema o l’utente** (verbo d’azione o sostantivo chiaro), non con contesto storico o “questa Epic copre…”.
3. **No duplicazione**: non ripetere il titolo della riga; non copiare paragrafi dal PRD generato da `mergePrd`.
4. **Ambito**: includi solo ciò che è **in scope** per quella riga; acronimi noti (RBAC, API) ok; evitare jargon interno non spiegato.
5. **Opzionale `readerBullets`**: se presente, massimo **3 bullet** corti; ogni bullet una sola idea; non duplicare il `summary`.

6. **`title` (issue Jira / tabella Blueprint)**: preferire formulazioni in italiano senza prefissi collezione (`tz_*`), path (`/portal`), nomi di file o permessi tecnici grezzi (`calendar.read`); il dettaglio resta in summary/discipline.

## Revisione per ondate

- **Ondata 1**: voci ad alto traffico (cross-cutting, auth, quote, clienti, dashboard).
- **Ondata 2**: completata su visual/UX refactor, hub integrazioni, Big Data/AI, CI/observability, discovery/experimental, pattern iTd (liste card/toggle, dialog/drawer); allineare il resto con audit gap (§3 COVERAGE_MATRIX) se emergono nuove righe.
- **Ondata 3**: rimossi nomi di file/route/backtick dai `summary` del blocco “estensione catalogo”; dettaglio implementativo resta nelle discipline; tre righe `technical` figlie e piccoli aggiustamenti (inbox, CSV, clienti) per evitare prefissi `tz_*` in Panoramica.

## Verifica rapida

- [ ] Leggibile in <10 secondi senza tab PRD.
- [ ] Coerente con discipline (tab Discipline) per ambito FE/BE.
