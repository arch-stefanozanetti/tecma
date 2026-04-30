# Validazione visiva shell OS prima dei test — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilire un ordine di lavoro in cui **si vede l’app in stile OS (lista + inspector)** in dev **prima** di lanciare la suite test completa, con checklist ripetibile e comandi esatti.

**Architecture:** Nessun cambiamento obbligatorio al prodotto: il piano è **operativo** (dev server, navigazione, viewport). Opzionale YAGNI: route dev con mock solo se l’ambiente reale non è raggiungibile. I test restano definiti nel piano `docs/plans/2026-03-22-macos-shell-inspector-layout.md` e nei file `*.test.tsx` esistenti.

**Tech Stack:** Node/pnpm, Vite (`fe-followup-v3`), browser Chromium-based consigliato, Vitest per fasi successive.

**Riferimenti skill:** @superpowers:verification-before-completion prima di dichiarare “tutto verde”; @superpowers:writing-plans per estendere task se serve la route mock.

---

### Task 1: Preparare ambiente dev frontend

**Files:**
- Read: `fe-followup-v3/README.md` o `.env.example` (se presente) per variabili `VITE_*`
- Modify: nessuna (solo esecuzione locale)

**Step 1: Posizionarsi nel package**

```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3
```

**Step 2: Installare dipendenze (se necessario)**

```bash
pnpm install
```

Expected: exit 0, nessun errore di lockfile.

**Step 3: Avviare Vite**

```bash
pnpm dev
```

Expected: console mostra URL locale (tipicamente `http://localhost:5173` o porta indicata da Vite).

**Step 4: Commit**

Nessun file modificato → skip commit, oppure commit solo se hai aggiunto note in README (fuori scope minimo).

---

### Task 2: Raggiungere Clienti e abilitare vista “OS”

**Files:**
- Reference: `fe-followup-v3/src/core/config/routes.ts` (`clients: "/clients"`)

**Step 1: Login e progetto**

Aprire l’URL del dev server, completare login come da ambiente (BSS o Followup in base a `VITE_USE_BSS_AUTH`). Selezionare un progetto/workspace con permesso **clients.read** se richiesto dalla shell.

**Step 2: Navigare a Clienti**

Andare a path: `/clients` (da sidebar “Clienti” o barra indirizzi).

Expected: pagina lista clienti con layout journey esistente; su desktop largo, area tabella + eventuale inspector dopo selezione riga.

**Step 3: Impostare viewport desktop**

Portare la finestra del browser a **≥ 768px** di larghezza (o il breakpoint effettivo usato da `useIsMobile` in `ClientsPage` — verificare in `fe-followup-v3/src/core/shared/useIsMobile.ts` se serve precisione).

**Step 4: Selezionare una riga**

Click su una riga cliente.

Expected: pannello inspector a destra (desktop) con riepilogo e pulsante “Apri scheda”; lista resta scrollabile a sinistra.

**Step 5: Commit**

Nessun commit (solo verifica manuale).

---

### Task 3: Checklist visiva (smoke “stile OS”)

**Files:** nessuna

**Step 1: Chrome stabile**

Verificare che sidebar e top bar non “saltino” aprendo/chiudendo inspector.

**Step 2: Proporzioni**

Lista ha `flex-1 min-w-0`; inspector ha larghezza massima ragionevole (non invade tutta la pagina).

**Step 3: Separazione visiva**

Bordo sinistro dell’inspector (`border-l`) visibile e coerente con tema chiaro/scuro.

**Step 4: Due CTA distinte**

- Inspector: bottone con etichetta che matcha **esattamente** “Apri scheda” (test usano regex `^Apri scheda$` case-insensitive dove applicabile).  
- Riga: “Apri scheda completa” non deve essere confuso con il precedente.

**Step 5: Mobile**

Ridurre larghezza sotto breakpoint mobile: inspector a colonna non deve restare come colonna fissa inutilizzabile; sheet o navigazione devono funzionare.

**Step 6: Commit**

Annotare in issue/PR o screenshot opzionale; nessun commit obbligatorio.

---

### Task 4: (Opzionale) Route dev con mock — solo se Task 2 fallisce per API/login

**Files:**
- Create (solo se necessario): es. `fe-followup-v3/src/dev/OsShellClientsPreview.tsx`  
- Modify: `fe-followup-v3/src/App.tsx` (route condizionata `import.meta.env.DEV`)

**Step 1: Decidere**

Se riesci a vedere `/clients` reale → **salta interamente questo task** (YAGNI).

**Step 2: Implementazione minima**

Route tipo `/__dev/os-clients` che renderizza `DesktopSplitStage` con `main` = tabella statica 2 righe e `inspector` = `ClientInspectorPanel` con oggetto `ClientRow` mock (campi obbligatori allineati a `src/types/domain.ts`).

**Step 3: Verifica**

Aprire `http://localhost:<porta>/__dev/os-clients` in desktop width.

**Step 4: Test**

Aggiungere un solo test che monta il preview component se la route resta — altrimenti nessun test (preferire cancellazione del codice dopo sblocco env reale).

**Step 5: Commit**

```bash
git add fe-followup-v3/src/dev/OsShellClientsPreview.tsx fe-followup-v3/src/App.tsx
git commit -m "chore(dev): optional OS shell preview route behind DEV"
```

---

### Task 5: Dopo la preview — test mirati (non ancora suite intera)

**Files:**
- Test: `fe-followup-v3/src/core/shared/DesktopSplitStage.test.tsx`  
- Test: `fe-followup-v3/src/core/clients/ClientInspectorPanel.test.tsx`  
- Test: `fe-followup-v3/src/core/clients/ClientsPage.test.tsx`

**Step 1: Eseguire file singoli**

```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3
pnpm exec vitest run src/core/shared/DesktopSplitStage.test.tsx
pnpm exec vitest run src/core/clients/ClientInspectorPanel.test.tsx
pnpm exec vitest run src/core/clients/ClientsPage.test.tsx
```

Expected: tutti PASS.

**Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

**Step 3: Commit**

Solo se hai corretto test o codice in questa fase:

```bash
git add <file coinvolti>
git commit -m "test(clients): align assertions after OS shell layout"
```

---

### Task 6: Gate finale — suite completa

**Files:** nessuna modifica attesa

**Step 1: Lint core (opzionale ma consigliato)**

```bash
pnpm run test:lint:core
```

**Step 2: Suite unit**

```bash
pnpm test:run
```

Expected: exit 0 (se fallisce, usare @superpowers:systematic-debugging sul primo failure).

**Step 3: Build**

```bash
pnpm build
```

Expected: exit 0.

**Step 4: Commit**

Solo se ci sono fix emersi dagli step precedenti.

---

## Ordine riassuntivo

1. Task 1 → Task 2 → Task 3 (preview “umana”)  
2. Task 4 solo se bloccato  
3. Task 5 → Task 6 (automazione)
