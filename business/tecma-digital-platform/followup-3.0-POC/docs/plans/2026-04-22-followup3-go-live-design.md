# Followup 3.0 — Go-Live Agenzie Standard: Design a Ondate

**Data:** 2026-04-22
**Stato:** Approvato (brainstorming)
**Driver:** Go-live su agenzie standard (non enterprise)
**Perimetro:** A (codice) + B (deliverable prep security/legal) + C (proposte scope strategico)

---

## 0. Premessa e metodo

Questo documento è il design di alto livello concordato al termine del brainstorming del 2026-04-22. Definisce **cosa si costruisce**, **in che ordine**, **con quale livello di verifica**. Non è un implementation plan: ogni ondata avrà un proprio plan dedicato, scritto al momento di entrare nell'ondata, con aderenza massima al contesto reale.

**Principi:**
- **Foundation-first:** le primitive del design system vengono prima dei consumer.
- **Urgenza sul driver:** l'ordine delle ondate segue "cosa blocca il go-live agenzie standard".
- **Verifica proporzionata al rischio:** L1 per UX pure, L2 per flussi con backend, L3 per feature critiche pre-go-live.
- **Profilo architetturale bilanciato:** nuove dipendenze npm sono ammesse dove il beneficio è netto; refactor diffuso solo dove evitabile produce più costo.

---

## 1. Struttura a ondate

| # | Ondata | Contenuto sintetico | Sessioni stimate | Verification |
|---|---|---|---|---|
| **W0** | Foundation DS | Skeleton, EmptyState, DataTable, form helper, fallback token | 1-2 | L1 |
| **W1** | Demo-ready | Applicazione primitive, bulk action, kanban dnd, parità visiva FASE8, empty state ovunque, filtri persistiti | 3-4 | L1 + L3 (parità visiva) |
| **W2** | Onboarding-ready | CSV import clienti/appartamenti/quote, Gmail sync, inbox contract, UX mobile | 3-4 | L2 |
| **W3** | i18n + polish | react-i18next setup + migrazione, dark mode completion, keyboard shortcuts, dedup dropdown | 2 | L1 |
| **W4** | B prep + C proposals + security test harness | Aikido integration, test suite security (abuse/tenant/auth), auth hardening, DPA template, GDPR scope, audit immutability design, proposte strategiche C1-C6 | 2 | L3 per deliverable |

**Totale stimato:** ~12-14 sessioni. Parallelismo: dentro ogni wave via subagent+worktree; tra wave no (dipendenze); W4 può correre in parallelo a W2 (non tocca codice applicativo, solo security tests + docs).

---

## 2. W0 — Foundation DS

### 2.1 Primitive introdotte

**`<Skeleton>`** (`src/components/ui/skeleton.tsx`)
- Atomo: `<Skeleton className="h-4 w-full" />` (CSS shimmer, zero dep)
- Preset: `<SkeletonTable rows cols />`, `<SkeletonCard />`, `<SkeletonList rows />`
- Rimpiazza: tutti i `"Caricamento..."` testuali trovati grep-ando nel frontend

**`<EmptyState>`** (`src/components/ui/empty-state.tsx`)
- API: `<EmptyState icon title description action />`
- Variants: `default`, `search` (no risultati filtro), `error`
- Rimpiazza: messaggi testuali inline "Nessun X trovato"

**`<DataTable>`** (`src/components/ui/data-table.tsx`)
- Libreria: `@tanstack/react-table` (nuova dep)
- Capabilities: sort, selection, server-side pagination, loading (SkeletonTable), empty slot, bulk actions bar
- Contratto API: `?sortField=&sortDirection=&page=&pageSize=` (definito qui, adeguamento route-per-route in W1)

**Form helper** (`src/lib/forms/`)
- `useZodForm()` + `<FormField>` wrapper integrato con `<Input>`/`<Select>` DS
- Validation inline, `aria-describedby` corretto
- **No refactor form esistenti in W0**: solo infra pronta

**Fix `tailwind.theme.fallback.js`**
- Popolo `fontFamily`, `fontSize`, `fontWeight` con copia statica dal token package
- Evita collasso silenzioso in worktree/CI senza `@tecma/design-system-tokens`

### 2.2 Pagina demo
`src/pages/dev/ds-preview.tsx` (solo in dev build) con tutti i variant delle primitive. Serve come verifica visiva e come documentazione viva.

### 2.3 Done L1
- `npm run build` pulito
- `npm run typecheck` pulito
- Unit test happy path + 1-2 edge per ogni primitiva
- Pagina demo funzionante
- Nessuna regressione visibile in app esistente

### 2.4 Rischi W0
- **API `<DataTable>` verbosa:** mitigazione — iterare con il primo consumer reale in W1 prima di applicarla a 5 liste.
- **Server-side pagination contract non uniforme:** definito in W0, adeguamento route-per-route in W1 (non in W0).

---

## 3. W1 — Demo-ready

Applicazione massiccia delle primitive + parità visiva FASE8.

**Contenuto target:**
- `ClientsListSection` → `<DataTable>` con sort + bulk + server pagination
- `RequestsBoardSection` → kanban con drag-and-drop via `@dnd-kit/core`
- Form clienti + trattative → migrati a `react-hook-form + zod`
- Filtri persistiti in `localStorage` (custom hook `usePersistedFilters`)
- `<EmptyState>` in tutti i punti con "nessun risultato"
- `<Skeleton>` ovunque al posto di `"Caricamento..."`
- Parità visiva FASE8: checklist `docs/deliverables/FASE8_VISUAL_PARITY.md` spuntata pagina per pagina

**Done:**
- L1 per primitive + filtri + empty state
- L3 per parità visiva (deploy staging + smoke manuale confermato)

---

## 4. W2 — Onboarding-ready

Abilita l'onboarding reale di agenzie con dati esistenti.

**Contenuto target:**
- **CSV import clienti/appartamenti/quote** — completa migrazione legacy; estende il csv-mapping quote già fatto con matrici cliente e appartamento, più UI di mapping colonne guidata
- **Gmail sync** — OAuth Google + refresh token lifecycle + merge eventi unificato (specchio di Outlook esistente)
- **Inbox contract** — contratto esplicito "cosa genera quale notifica", preferenze mute per categoria, empty state inbox, link al contesto
- **UX mobile** — checklist pagina per pagina, focus su cockpit/clients/requests/calendar

**Done:** L2 (integration test con backend reale + Playwright smoke sul flusso CSV import end-to-end)

---

## 5. W3 — i18n + polish

**Contenuto target:**
- Setup `react-i18next` + loader JSON namespace per route
- Migrazione stringhe file-by-file (17+ file identificati, lista in implementation plan)
- Italiano come default + inglese come secondo locale (scheletro)
- Dark mode completion: classi `dark:` in pagine core (cockpit, clients, requests, apartments, calendar)
- Keyboard shortcuts globali: `N` nuovo cliente, `T` nuova trattativa, `R` refresh lista
- Dedup dropdown custom `ClientsListSection.tsx:109` → usa `DropdownMenu` DS

**Done:** L1

---

## 6. W4 — B + C + Security test harness

Si divide in tre blocchi, eseguibili in parallelo con W2 se c'è bandwidth.

### 6.1 B — Security & Legal deliverables

| ID | Deliverable | Path |
|---|---|---|
| **B.1a** | Aikido integration (SaaS collegato, baseline triage) | setup + `docs/security/aikido-setup.md` |
| **B.1b** | Aikido security runbook | `docs/security/aikido-runbook.md` |
| **B.1c** | Manual security checklist trimestrale | `docs/security/manual-security-checklist.md` |
| **B.1d** | Abuse Test Suite (business logic + webhook forgery) | `be-followup-v3/tests/security/abuse/` |
| **B.1e** | Tenant Isolation Test Harness | `be-followup-v3/tests/security/tenant-isolation/` |
| **B.1f** | Auth Deep Test Pack (refresh theft, replay, race) | `be-followup-v3/tests/security/auth-deep/` |
| **B.1g** | Auth Hardening Round (MFA enforcement, session timeout, per-user rate limit) | code changes sparse, PR dedicata |
| **B.2** | DPA Template (bozza tecnica) | `docs/legal/dpa-template.md` |
| **B.3** | GDPR Consent Scope (promozione spike → firmabile) | `docs/legal/gdpr-consent-scope.md` |
| **B.4** | OWASP Hardening Round (CSP, HSTS, CSRF review, input sanitization audit) | code changes sparse + `docs/security/owasp-hardening-report.md` |
| **B.5** | Audit Log Immutability Design | `docs/security/audit-immutability-design.md` |

**Scelta strategica approvata:** Aikido-only per pentest (driver = agenzie standard). Se/quando arriva enterprise, ingaggiare vendor pentest terzo.

### 6.2 C — Proposte scope strategico (UN SOLO documento)

`docs/plans/C-strategic-scope-proposals.md` contiene:
- Matrice valore/effort per i 6 temi sul filtro "agenzie standard"
- **Approfondimento esteso:** C.3 Portale cliente self-service, C.5 Catalogo connettori
- **Scheda sintetica:** C.1 Pagamenti, C.2 AML, C.4 Fideiussioni, C.6 MFA hardware keys (WebAuthn/FIDO2)
- Raccomandazione di sequencing

Output: design doc, nessuna implementazione in questa fase.

### 6.3 Responsabilità esplicitamente fuori scope dev

Flag nel design doc, **non lavoro di Claude**:
- **Social engineering / phishing simulation** → servizio terzo (KnowBe4, Hoxhunt, Proofpoint)
- **Security awareness training operatori** → HR / LMS interno
- **Firma legale del DPA** → legale esterno
- **Esecuzione pentest human-led** → vendor certificato (se driver cambia a enterprise)
- **Certificazioni SOC2 / ISO 27001** → programma pluriennale con auditor certificato

---

## 7. Delivery & outputs model

### 7.1 Pattern per-ondata

1. **Inizio wave N:** rileggo design doc, valido se il contenuto regge ancora dato quanto imparato
2. Invoco skill `writing-plans` → produco `docs/plans/wave-N-<nome>-plan.md`
3. Eseguo plan in step verificabili (TDD dove possibile via skill `test-driven-development`)
4. Parallelismo dove possibile via `dispatching-parallel-agents` + `isolation: worktree`
5. Verification proporzionata al livello L1/L2/L3 definito per wave
6. Invoco skill `verification-before-completion` prima di marcare done
7. Commit per step coerenti, non mega-commit
8. Chiusura wave N: documento cosa è cambiato rispetto al design, apro N+1

### 7.2 Livelli di verification

| Livello | Richiede | Applicato a |
|---|---|---|
| **L1** | Build + typecheck + unit test + verifica visiva locale | Primitive DS, UX pure (skeleton, empty state, sort, dark mode), i18n, polish |
| **L2** | L1 + integration test con backend reale + Playwright smoke flusso | Bulk action API, CSV import, Gmail sync, inbox contract |
| **L3** | L2 + deploy staging + smoke manuale confermato da owner | Parità visiva FASE8 finale, migrazione dati legacy reale, deliverable security |

### 7.3 Gestione deviazioni

- **Design sbagliato rilevato mid-wave:** stop, documento gap, aggiorno design, riapprovo, riparto. Niente forzature.
- **Sfondamento >50% tempo stimato:** triage — cosa taglio, cosa sposto, cosa è scope creep.
- **Scoperta nuovo gap fuori design:** non lo implemento di slancio; lo annoto, lo valuto alla prossima re-validazione di wave.

---

## 8. Vincoli architetturali approvati

**Profilo bilanciato:**
- **Nuove dep npm ammesse** dove beneficio netto: `@tanstack/react-table` (W0), `@dnd-kit/core` (W1), `react-hook-form` + `zod` (W0 infra, W1 applicazione), `react-i18next` (W3).
- **Refactor diffuso** solo dove pulisce debito reale (esempio: i18n sì, perché metà-i18n è peggio di zero-i18n). Evitato altrove.
- **Estensione DS** solo dei componenti richiesti dai gap; nessuna astrazione preventiva.

---

## 9. Prossimo step operativo

Al termine di questo doc si invoca skill `superpowers:writing-plans` per produrre il primo implementation plan: **W0 Foundation DS**. Gli altri plan si scrivono al momento di entrare nella rispettiva ondata.

---

## Appendice A — Elenco gap coperti / non coperti

### Coperti da questo design (A)
- P0 UX: Skeleton (W0→W1), Bulk action (W1), Column sorting (W0→W1)
- P1 UX: Kanban dnd (W1), Form validation inline (W0→W1), Filtri persistiti (W1), i18n (W3)
- P2 UX: Dark mode completion (W3), Dropdown dedup (W3), Empty state (W0→W1), Keyboard shortcuts (W3), Fallback token (W0)
- Gap funzionali: Preventivo digitale QA (parte di W1/W2 parità), Gmail sync (W2), Inbox contract (W2), Parità visiva FASE8 (W1), Migrazione CSV (W2), UX mobile (W2)

### Coperti come deliverable prep (B)
- Pentest (via Aikido + test harness automatici B.1d-f + manual checklist B.1c)
- DPA / GDPR (bozze tecniche B.2-B.3)
- Audit immutability (design B.5)
- OWASP hardening (B.4)
- Auth hardening (B.1g)

### Proposte per decisione successiva (C)
- C.1 Pagamenti/contabilità
- C.2 AML nativo
- C.3 Portale cliente self-service
- C.4 Fideiussioni + preliminare
- C.5 Catalogo connettori (Meta Ads, Google Ads, DocuSign, HubSpot, Zapier)
- C.6 MFA hardware keys (WebAuthn/FIDO2)

### Esplicitamente fuori scope dev
- Social engineering / phishing simulation (servizio terzo)
- Security awareness training (HR)
- Firma legale DPA (avvocato)
- Pentest human-led (vendor, solo se cambia driver a enterprise)
- Certificazioni SOC2 / ISO 27001 (auditor certificato, programma pluriennale)
