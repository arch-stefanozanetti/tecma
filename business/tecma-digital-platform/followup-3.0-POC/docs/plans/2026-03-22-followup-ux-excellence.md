# Followup — eccellenza UX/UI (shell operativa) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (o subagent-driven-development in sessione) task-by-task.

**Goal:** Portare l’esperienza verso **standard “pro”** (chiarezza, velocità sui task ripetuti, coerenza cross-pagina, accessibilità) partendo dalla **shell desktop tipo OS** già avviata su Clienti, senza inflazionare il prodotto.

**Architecture:** Trattare **pattern ripetibili** (`DesktopSplitStage`, inspector compatto, gerarchia lista/dettaglio) come contratto UX tra journey; ogni miglioramento deve essere **misurabile** (checklist + test dove ha senso). Priorità: **1) comprensione e azioni primarie**, **2) coerenza**, **3) polish visivo**.

**Tech Stack:** React, Tailwind, Radix/shadcn, Vitest, Playwright opzionale per smoke.

**Riferimenti:** `docs/plans/2026-03-22-os-shell-visual-validation.md` (preview prima dei test); `ARCHITECTURE.md` (shell desktop).

---

## Principi (non negoziabili)

1. **Un solo focus per schermata** — lista lavora sulla scansione; inspector sul contesto record; niente competizione tra hero lunghi e tabella.
2. **Stessa grammatica su tutte le liste journey** — click riga = contesto; CTA esplicite per “vista piena”.
3. **Accessibilità minima** — ordine focus, etichette univoche, contrasto, `aria` su split/pannelli dove manca.
4. **Mobile prima nel senso del vincolo** — sheet/drawer devono restare first-class; desktop è enhancement.

---

### Task 1: Audit UX Clienti (desktop + mobile) — output checklist

**Files (read):**
- `fe-followup-v3/src/core/clients/ClientsPage.tsx`
- `fe-followup-v3/src/core/clients/ClientsListSection.tsx`
- `fe-followup-v3/src/core/clients/ClientInspectorPanel.tsx`
- `fe-followup-v3/src/core/shared/DesktopSplitStage.tsx`

**Output:** Documento breve (issue Confluence o commento in PR) con tabella: problema | gravità (P0–P2) | fix proposto | file.

**Step 1:** Percorso reale `pnpm dev` → `/clients` (vedi piano visual validation).

**Step 2:** Compilare checklist: empty state, loading, errore API, selezione nulla, due CTA (“Apri scheda” vs “Apri scheda completa”), keyboard (Tab) nell’inspector.

**Step 3:** Nessun commit obbligatorio (solo artefatto review).

---

### Task 2: P0 — Allineamento copy, gerarchia titoli e stati vuoti inspector

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientInspectorPanel.tsx`
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx` (solo se copy/layout dipendono dal parent)
- Test: `fe-followup-v3/src/core/clients/ClientInspectorPanel.test.tsx`

**Acceptance criteria (esempi):**
- Titolo inspector = nome cliente leggibile; meta secondarie (email/telefono) sotto, non competono col titolo.
- Stato “nessun cliente selezionato” o placeholder chiaro se il product accetta selezione vuota su desktop.
- Ogni controllo interattivo ha `name` accessibile unico dove i test già usano regex stretti.

**Step 1:** Test aggiornati o nuovi per copy/ruoli accessibili.

**Step 2:** `pnpm exec vitest run src/core/clients/ClientInspectorPanel.test.tsx`

**Step 3:** `pnpm typecheck`

**Step 4:** Commit mirato.

---

### Task 3: P1 — Focus e tastiera: lista ↔ inspector

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsListSection.tsx` (row `tabIndex`, `aria-selected`, handler tastiera se mancante)
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx` (ref opzionale per focus inspector dopo selezione — solo se non invasivo)
- Test: `fe-followup-v3/src/core/clients/ClientsPage.test.tsx` o test dedicato lista

**Acceptance criteria:**
- Con selezione da tastiera, il focus non “sparisce”; annuncio coerente per screen reader dove fattibile senza over-engineering.

**Step 1–4:** TDD leggero; vitest; typecheck; commit.

---

### Task 4: P1 — Replicare pattern shell su **Appartamenti** (parità con Clienti)

**Files:**
- Read piano: `docs/plans/2026-03-22-macos-shell-inspector-layout.md` (fase 2)
- Modify: `ApartmentsPage.tsx`, `ApartmentsListSection.tsx`, nuovo `ApartmentInspectorPanel.tsx` se necessario
- Test: speculari a Clients

**Acceptance criteria:**
- Desktop: split + inspector; mobile: comportamento esistente non peggiorato.

---

### Task 5: P2 — Requests board / lista (valutare idoneità split)

**Files:** `RequestsPage.tsx`, sezioni lista/board

**Step 1:** Spike UX (mezza giornata): lo split ha senso per Kanban o solo per vista tabellare? Documentare decisione **go/no-go** prima del codice.

---

### Task 6: Verifica

**Run:**
```bash
cd fe-followup-v3
pnpm exec vitest run src/core/clients/
pnpm typecheck
pnpm test:run
```

Expected: PASS / exit 0.

---

## Ordine consigliato (PO)

Task 1 → Task 2 → Task 3 → Task 4 → Task 5 (spike) → Task 6.
