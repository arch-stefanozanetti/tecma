# Followup — Shell desktop macOS + inspector (piano implementazione)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Portare il CRM verso un comportamento **tipo macOS**: chrome stabile (sidebar + top bar esistenti), **area centrale tabellare** dove ha senso, **inspector fisso a destra** su desktop per il contesto record (visuale ma compatto), senza impilare hero/marketing sopra CRUD; mobile resta **sheet** come oggi.

**Architecture:** Introduci primitive layout `DesktopSplitStage` + (opzionale) `DesktopInspectorPanel` in `core/shared`, con breakpoint **desktop vs mobile** riusando `useIsMobile`. **Pilot su Clienti**: click riga su desktop imposta selezione e mostra inspector con riepilogo + CTA “Apri scheda completa” (`/clients/:id`); su mobile il flusso attuale (navigate o sheet) non peggiora. Fase 2 (fuori scope obbligatorio di questo piano): replicare pattern su **Appartamenti** e **Requests**, poi valutare **layout route** annidate in `App.tsx` per URL condiviso lista+dettaglio.

**Tech Stack:** React 18, React Router 6, Vite, TypeScript, Tailwind, Vitest, componenti UI esistenti (`Sheet`, `Button`), `fe-followup-v3/src/core/shared/useIsMobile.ts`.

**Riferimenti skill:** @superpowers:test-driven-development per ogni nuovo modulo con logica; @superpowers:verification-before-completion prima di dichiarare completato.

---

### Task 1: Test fallimentare per `DesktopSplitStage`

**Files:**
- Create: `fe-followup-v3/src/core/shared/DesktopSplitStage.test.tsx`
- Implement: `fe-followup-v3/src/core/shared/DesktopSplitStage.tsx` (vuoto o stub che fallisce)

**Step 1: Scrivere il test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DesktopSplitStage } from "./DesktopSplitStage";

describe("DesktopSplitStage", () => {
  it("rende main e inspector quando showInspector e children inspector sono passati", () => {
    render(
      <DesktopSplitStage
        main={<div data-testid="main">Lista</div>}
        inspector={<aside data-testid="inspector">Dettaglio</aside>}
        showInspector
      />
    );
    expect(screen.getByTestId("main")).toBeInTheDocument();
    expect(screen.getByTestId("inspector")).toBeInTheDocument();
  });
});
```

**Step 2: Eseguire il test**

Run: `pnpm -C fe-followup-v3 exec vitest run src/core/shared/DesktopSplitStage.test.tsx`

Expected: FAIL (export mancante o componente non implementato).

**Step 3: Implementazione minima**

Creare `DesktopSplitStage.tsx` che accetta `main: ReactNode`, `inspector?: ReactNode`, `showInspector?: boolean` e renderizza un contenitore `flex flex-row flex-1 min-h-0` con `main` in `flex-1 min-w-0` e, se `showInspector && inspector`, colonna destra `w-full max-w-md xl:max-w-[380px] shrink-0 border-l border-border bg-background`.

**Step 4: Rieseguire il test**

Run: `pnpm -C fe-followup-v3 exec vitest run src/core/shared/DesktopSplitStage.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add fe-followup-v3/src/core/shared/DesktopSplitStage.tsx fe-followup-v3/src/core/shared/DesktopSplitStage.test.tsx
git commit -m "feat(shared): add DesktopSplitStage layout primitive"
```

---

### Task 2: Comportamento responsive — nascondi inspector sotto breakpoint

**Files:**
- Modify: `fe-followup-v3/src/core/shared/DesktopSplitStage.tsx`
- Modify: `fe-followup-v3/src/core/shared/DesktopSplitStage.test.tsx`

**Step 1: Test** — aggiungere caso con `showInspector` false: l’inspector non deve comparire nel DOM (o avere `hidden`).

**Step 2: Run test** — Expected: FAIL.

**Step 3: Implementazione** — accettare prop opzionale `collapseInspector?: boolean` oppure gestire solo `showInspector`; documentare nel JSDoc che il **parent** deve passare `showInspector={!isMobile && !!selected}` così non duplicare hook nel layout puro.

**Step 4: Run test** — Expected: PASS.

**Step 5: Commit** — `fix(shared): DesktopSplitStage rispetta showInspector`

---

### Task 3: Estrarre `ClientInspectorPanel` dalla Sheet esistente

**Files:**
- Create: `fe-followup-v3/src/core/clients/ClientInspectorPanel.tsx`
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx` (import + uso)

**Step 1:** Spostare il markup dentro `SheetContent` (righe ~464–520+ di `ClientsPage.tsx`, fino ai pulsanti) in un componente presentazionale `ClientInspectorPanel` con props:

`client: ClientRow`, `canClientsRead: boolean`, `onOpenFull: () => void`, `onClose?: () => void` (opzionale per uso desktop senza close).

**Step 2:** Test unitario leggero (opzionale ma consigliato): `ClientInspectorPanel.test.tsx` che verifica rendering email e bottone “Apri scheda”.

Run: `pnpm -C fe-followup-v3 exec vitest run src/core/clients/ClientInspectorPanel.test.tsx`

**Step 3:** In `ClientsPage`, usare `ClientInspectorPanel` dentro `Sheet` per non duplicare JSX.

**Step 4:** `pnpm -C fe-followup-v3 typecheck`

**Step 5: Commit** — `refactor(clients): extract ClientInspectorPanel`

---

### Task 4: Pilot desktop — lista + inspector affiancati su Clienti

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`
- Modify: `fe-followup-v3/src/core/clients/ClientsListSection.tsx` (solo se serve nuova prop `onRowSelect` vs `onOpenClient`)

**Step 1:** Introdurre stato `inspectorClientId: string | null` (o riusare `selectedClient` allineandolo al click riga su desktop).

**Step 2:** Su **desktop** (`!isMobile`):  
- `ClientsListSection` deve chiamare un handler che **imposta** il cliente selezionato e **non** navigare subito (es. nuova prop `onClientRowActivate?: (c: ClientRow) => void` usata solo desktop; `onOpenClient` resta per doppio click o bottone esplicito “Apri in nuova vista” se preferite — documentare scelta nel commit).  
- Avvolgere la zona sotto `JourneyPageScaffold` (solo tabella + toolbar lista, non l’intero hero se si vuole ridurre altezza) in `DesktopSplitStage` con `inspector={<ClientInspectorPanel ... />}`.

**Step 3:** Su **mobile**: mantenere `Sheet` esistente O navigate; non mostrare colonna inspector.

**Step 4:** Verificare manualmente: desktop — click riga apre inspector; “Apri scheda completa” va a `/clients/:id`. Mobile — nessuna regressione.

**Step 5:** Run:

```bash
pnpm -C fe-followup-v3 typecheck
pnpm -C fe-followup-v3 test:run -- src/core/shared/DesktopSplitStage.test.tsx
pnpm -C fe-followup-v3 build
```

**Step 6: Commit** — `feat(clients): desktop split list + inspector (macOS-style)`

---

### Task 5: Allineamento visivo — ridurre “doppio chrome” in journey + split

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`
- Modify: `fe-followup-v3/src/core/shared/ProductOS.tsx` (solo se serve prop per compattezza hero)

**Step 1:** Con `surfaceMode === "archive"` o quando `inspectorClientId` è valorizzato, valutare **padding** del contenitore lista (`px-5 lg:px-20` → `px-4 lg:px-6` nel solo blocco tabella) per avvicinarsi a Finder (decisione documentata in commento breve).

**Step 2:** Non introdurre nuovi hero; eventuale `GovernanceSummaryBand` resta sopra lo split solo se non duplica metriche nell’inspector.

**Step 3:** `pnpm -C fe-followup-v3 check:detail-architecture` se lo script esiste e applica al clients (vedi output).

**Step 4: Commit** — `style(clients): tighten stage padding for split layout`

---

### Task 6: Documentazione architettura

**Files:**
- Modify: `fe-followup-v3/ARCHITECTURE.md`

**Step 1:** Aggiungere sotto-sezione “Desktop shell (macOS metaphor)”: `DesktopSplitStage`, uso su Clienti, roadmap Appartamenti/Requests.

**Step 2:** Commit — `docs: document DesktopSplitStage and inspector pattern`

---

## Verifica finale (obbligatoria)

```bash
pnpm -C fe-followup-v3 typecheck
pnpm -C fe-followup-v3 test:run
pnpm -C fe-followup-v3 build
```

## Fuori scope immediato (backlog)

- Layout route `App.tsx` con `<Outlet />` per `/clients` + `/clients/:id` nella stessa shell split con URL sincronizzato.
- Copilot rail vs inspector: regole di precedenza visiva.
- Stesso pattern su `ApartmentsPage` / `RequestsPage`.
- Token CSS dedicati “desktop chrome” in `styles.css` se servono.

---

*Piano salvato in `docs/plans/2026-03-22-macos-shell-inspector-layout.md`.*
