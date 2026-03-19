# Suggerimenti Cockpit aggregati — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ridurre card duplicate e generiche aggregando per “famiglia” di regola (max 8 gruppi), persistendo `aggregatedKind` + `aggregatedItems`, espandendo i dettagli in UI, e sostituendo i pending stesso-kind al refresh POST.

**Architecture:** La logica rule-based in [`be-followup-v3/src/core/ai/orchestrator.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator.service.ts) passa da N righe per associazione a **G righe** (una per `aggregatedKind`). Il LLM in [`suggestions-llm.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/suggestions-llm.service.ts) riceve **un candidato per gruppo** e restituisce **lo stesso ordine/cardinalità**; il merge mantiene `aggregatedKind` e `aggregatedItems` dal rule-based. Prima di `insertMany`, **`deleteMany`** su pending con stesso `workspaceId`, stesso set `projectIds` e `aggregatedKind` ∈ kinds del nuovo batch (**strategia A** dal design). GET pending restituisce i nuovi campi; FE mappa in [`PrioritySuggestionsList.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.tsx) con accordion e cap K=10 righe.

**Tech Stack:** TypeScript, MongoDB (`tz_ai_suggestions`), Zod, Vitest (BE/FE), React 18, design doc di riferimento [`2026-03-19-aggregated-ai-suggestions-design.md`](./2026-03-19-aggregated-ai-suggestions-design.md).

---

## Tipi condivisi (aggregated)

**Costanti suggerite:**

- `MAX_SUGGESTION_GROUPS = 8` (macro-card Cockpit).
- `MAX_AGGREGATED_ITEMS_STORED = 50` (limite sicurezza documento Mongo).
- `MAX_AGGREGATED_ITEMS_UI = 10` (righe visibili prima di “… e altre M”).

**Shape `aggregatedItems` (elemento):**

```ts
{
  associationId?: string;
  clientId?: string;
  apartmentId?: string;
  label: string; // es. "Appartamento Vendita 1" o "Mario Rossi × Apt X"
}
```

**Valori `aggregatedKind` (stringhe stabili):**

- `stale_proposal_7d`
- `inactive_client_20d`
- `available_unit` (nota: oggi una riga per appartamento → aggregare in un gruppo con items multipli)
- `no_critical_signal` (fallback unico quando non ci sono altri segnali)

---

### Task 1: Estendere tipi BE `RuleBasedSuggestionRow` e documento Mongo

**Files:**

- Modify: [`be-followup-v3/src/core/ai/suggestions-llm.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/suggestions-llm.service.ts) (tipo `RuleBasedSuggestionRow`)
- Modify: [`be-followup-v3/src/core/ai/orchestrator.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator.service.ts) (`SuggestionDoc`)

**Step 1 — Aggiungi campi opzionali al tipo**

```ts
// In RuleBasedSuggestionRow (suggestions-llm.service.ts)
aggregatedKind: string;
aggregatedItems?: Array<{
  associationId?: string;
  clientId?: string;
  apartmentId?: string;
  label: string;
}>;
```

`aggregatedKind` obbligatorio su ogni riga generata dalla nuova pipeline (il fallback `no_critical_signal` lo include).

**Step 2 — Allinea `SuggestionDoc`**

Stessi campi opzionali su `SuggestionDoc` per lettura/scrittura Mongo.

**Step 3 — Commit**

```bash
git add be-followup-v3/src/core/ai/suggestions-llm.service.ts be-followup-v3/src/core/ai/orchestrator.service.ts
git commit -m "feat(ai): add aggregatedKind and aggregatedItems to suggestion types"
```

---

### Task 2: Test unitario — raggruppamento `stale_proposal_7d`

**Files:**

- Create: [`be-followup-v3/src/core/ai/orchestrator-aggregate.test.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator-aggregate.test.ts)
- Modify: [`be-followup-v3/src/core/ai/orchestrator.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator.service.ts) — **esportare** `buildRuleBasedRows` (o estrarre in `suggestion-rules-aggregate.service.ts` e importare qui) per testare senza DB.

**Step 1 — Test che fallisce**

```ts
import { describe, it, expect } from "vitest";
import { buildRuleBasedRows } from "./orchestrator.service.js";

describe("buildRuleBasedRows aggregation", () => {
  it("unisce più associazioni proposta ferma in un solo gruppo stale_proposal_7d", () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const apartments = [
      { _id: "a1", name: "Apt 1", status: "AVAILABLE" },
      { _id: "a2", name: "Apt 2", status: "AVAILABLE" },
    ];
    const associations = [
      { status: "proposta", updatedAt: old, apartmentId: "a1", _id: "as1", clientId: "c1" },
      { status: "proposta", updatedAt: old, apartmentId: "a2", _id: "as2", clientId: "c2" },
    ];
    const rows = buildRuleBasedRows(
      { workspaceId: "w", projectIds: ["p1"], limit: 8 },
      [],
      apartments,
      associations,
      now
    );
    const stale = rows.filter((r) => r.aggregatedKind === "stale_proposal_7d");
    expect(stale).toHaveLength(1);
    expect(stale[0].aggregatedItems?.length).toBe(2);
  });
});
```

**Step 2 — Esegui test (deve fallire)**

```bash
cd be-followup-v3 && npx vitest run src/core/ai/orchestrator-aggregate.test.ts
```

Expected: FAIL (comportamento vecchio: 2 righe o export mancante).

**Step 3 — Implementa aggregazione in `buildRuleBasedRows`**

- Per `stale_proposal_7d`: iterare associazioni, raccogliere match in array `items` (label da `apartmentMap`), poi **un** `push` con `title` tipo `Proposte ferme (${n})`, `reason` con conteggio, `recommendedAction` che elenca al massimo 3 nomi + “…” se >3, `score` es. 92, `aggregatedKind`, `aggregatedItems` slice a `MAX_AGGREGATED_ITEMS_STORED`.
- Stesso pattern per `inactive_client_20d` (un gruppo, items per cliente).
- Per `available_unit`: un gruppo `available_unit` con items per ogni unità AVAILABLE (non una riga per unità).
- Fallback: una riga `no_critical_signal` con `aggregatedItems: []` o assente.

Ordinamento gruppi: `risk` high > medium > low, poi `score` desc. Poi `.slice(0, input.limit)` dove `limit` da chiamante è già cap (usare `MAX_SUGGESTION_GROUPS` dalla chiamata `generateAiSuggestions` passando `Math.min(input.limit, 8)` se si vuole forzare 8 a livello orchestrator).

**Step 4 — Test verde**

```bash
cd be-followup-v3 && npx vitest run src/core/ai/orchestrator-aggregate.test.ts
```

Expected: PASS.

**Step 5 — Commit**

```bash
git add be-followup-v3/src/core/ai/orchestrator.service.ts be-followup-v3/src/core/ai/orchestrator-aggregate.test.ts
git commit -m "feat(ai): aggregate rule-based suggestions by aggregatedKind"
```

---

### Task 3: `generateAiSuggestions` — delete pending stesso kind prima di insert

**Files:**

- Modify: [`be-followup-v3/src/core/ai/orchestrator.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator.service.ts) (`generateAiSuggestions`, dopo `rowsToInsert` costruito, prima di `insertMany`)

**Step 1 — Test di integrazione leggero (mock DB) oppure test unit su funzione pura `planSuggestionKinds(rows)`**

Opzione minima: test manuale documentato + test esistenti BE verdi.

Opzione TDD: estrarre `async function removePendingByKinds(db, workspaceId, projectIds, kinds: string[])` e mockare `collection.deleteMany` in vitest.

**Step 2 — Implementazione**

```ts
const kinds = [...new Set(rowsToInsert.map((r) => r.aggregatedKind).filter(Boolean))];
if (kinds.length > 0) {
  await db.collection("tz_ai_suggestions").deleteMany({
    workspaceId: input.workspaceId,
    status: "pending",
    aggregatedKind: { $in: kinds },
    // projectIds: stesso set — usa $size + $all (stesso pattern di query manuale) o filtra in codice dopo find; per semplicità: find pending per workspaceId e filter projectIdsSetEqual, poi deleteMany by _id — se troppo lento, usa $expr
  });
}
```

Nota: Mongo non ha uguaglianza array set nativa semplice; **riusare** `projectIdsSetEqual` dopo `find({ workspaceId, status: "pending", aggregatedKind: { $in: kinds } })` e `deleteMany({ _id: { $in: ids } })` se il set è piccolo, oppure query documentata nel codice.

**Step 3 — Run full BE tests**

```bash
cd be-followup-v3 && npm test -- --run
```

Expected: tutti PASS.

**Step 4 — Commit**

```bash
git commit -am "feat(ai): replace pending suggestions per aggregatedKind on regenerate"
```

---

### Task 4: LLM — merge 1:1 preservando `aggregatedKind` e `aggregatedItems`

**Files:**

- Modify: [`be-followup-v3/src/core/ai/suggestions-llm.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/suggestions-llm.service.ts)

**Step 1 — Aggiorna prompt di sistema**

Specificare che **il numero di elementi in output deve essere uguale** al numero di candidati in input (max `limit`), stesso ordine, e che non deve inventare nuove voci o unire due gruppi in una riga.

**Step 2 — Payload user**

Includere per ogni candidato: `aggregatedKind`, `itemCount: aggregatedItems?.length ?? 0`, `sampleLabels: aggregatedItems?.slice(0, 5).map(i => i.label)` (non inviare 50 label).

**Step 3 — Dopo `safeParse`**

```ts
return parsed.data.suggestions.slice(0, limit).map((s, i) => {
  const base = ruleBased[i];
  if (!base) return null;
  return {
    ...base,
    title: s.title,
    reason: s.reason,
    recommendedAction: s.recommendedAction,
    risk: s.risk,
    score: s.score,
    createdAt: now,
    llmRefined: true, // il chiamante sovrascrive llmRefined su insert; qui non necessario
  };
}).filter(Boolean);
```

Rimuovere campi duplicati; **`aggregatedKind` e `aggregatedItems` sempre da `base`**.

**Step 4 — Test vitest** (mock `completeJson`): input 2 gruppi, output LLM 2 titoli diversi, assert `aggregatedItems` invariati.

**Step 5 — Commit**

```bash
git commit -am "feat(ai): LLM refine preserves aggregated metadata 1:1"
```

---

### Task 5: `queryPendingAiSuggestions` — serializzare nuovi campi nella risposta API

**Files:**

- Modify: [`be-followup-v3/src/core/ai/orchestrator.service.ts`](tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/ai/orchestrator.service.ts) (`queryPendingAiSuggestions` mapping `data`)

Aggiungi `aggregatedKind` e `aggregatedItems` agli oggetti in `data` se presenti sul documento.

**Verify:** `GET /v1/ai/suggestions?...` (manuale o test route se esiste).

**Commit:** `feat(ai): expose aggregated fields on GET suggestions`

---

### Task 6: FE — tipi `AiSuggestion` e mapping Cockpit

**Files:**

- Modify: [`fe-followup-v3/src/types/domain.ts`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/types/domain.ts) (`AiSuggestion`)
- Modify: [`fe-followup-v3/src/core/cockpit/CockpitPage.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/CockpitPage.tsx) (`suggestionToCard`, rinominare costante a `MAX_PRIORITY_GROUPS = 8`)

```ts
// domain.ts — dentro AiSuggestion
aggregatedKind?: string;
aggregatedItems?: Array<{
  associationId?: string;
  clientId?: string;
  apartmentId?: string;
  label: string;
}>;
```

```ts
// suggestionToCard
aggregatedItems: s.aggregatedItems,
aggregatedKind: s.aggregatedKind,
```

**Files:**

- Modify: [`fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.tsx) — estendere `PriorityActionItem`.

**Commit:** `feat(cockpit): types for aggregated AI suggestions`

---

### Task 7: UI — accordion dettagli con cap K=10

**Files:**

- Modify: [`fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.tsx)

**Step 1 — Test che fallisce**

Create: [`fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.test.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/PrioritySuggestionsList.test.tsx)

```tsx
it("mostra Mostra dettagli e overflow quando >10 items", async () => {
  const items = [{
    id: "1", title: "T", urgency: "risk" as const, context: "c", action: "a",
    aggregatedItems: Array.from({ length: 12 }, (_, i) => ({ label: `L${i}` })),
  }];
  render(<PrioritySuggestionsList ... items={items} ... />);
  expect(screen.getByRole("button", { name: /Mostra dettagli/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Mostra dettagli/i }));
  expect(screen.getByText("L0")).toBeInTheDocument();
  expect(screen.getByText(/altre 2/i)).toBeInTheDocument();
});
```

**Step 2 — Implementa blocco espansione** sotto `Azione consigliata` (o sopra), lista `<ul>`, link `useNavigate` se `clientId` presente (`/clients/${id}`).

**Step 3 — Vitest**

```bash
cd fe-followup-v3 && npm test -- --run src/core/cockpit/PrioritySuggestionsList.test.tsx
```

**Step 4 — Commit**

```bash
git commit -am "feat(cockpit): expandable aggregated suggestion details"
```

---

### Task 8: Documentazione e test regressione

**Files:**

- Modify: [`followup-3.0/docs/AI_FLOWS.md`](tecma/business/tecma-digital-platform/followup-3.0/docs/AI_FLOWS.md) — paragrafo su aggregazione, campi API, refresh che sostituisce pending per `aggregatedKind`.
- Modify: [`fe-followup-v3/src/core/cockpit/CockpitPage.test.tsx`](tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3/src/core/cockpit/CockpitPage.test.tsx) — mock `getAiSuggestions` con `aggregatedItems` opzionale, assert assenza regressioni.

**Run:**

```bash
cd fe-followup-v3 && npm test -- --run src/core/cockpit/
cd be-followup-v3 && npm run build && npm test -- --run
```

**Commit:** `docs: AI_FLOWS aggregated suggestions`

---

## Checklist finale

- [ ] Nessuna regressione su `executeSuggestionWithAgent` (legge ancora `tz_ai_suggestions` per id).
- [ ] Documenti legacy senza `aggregatedKind`: GET li mostra ancora; opzionale migrazione one-off o trattarli come `undefined` in UI (nessun accordion).
- [ ] `MAX_SUGGESTION_GROUPS=8` allineato tra BE (limit passato a `buildRuleBasedRows`) e FE (`MAX_PRIORITY_GROUPS`).

---

## Execution handoff

**Plan complete and saved to** `docs/plans/2026-03-19-aggregated-ai-suggestions-implementation-plan.md`.

**Due opzioni di esecuzione:**

1. **Subagent-Driven (questa sessione)** — un subagent per task, review tra un task e l’altro (@superpowers:subagent-driven-development).
2. **Parallel Session (separata)** — nuova sessione in worktree con @superpowers:executing-plans e checkpoint.

**Quale approccio preferisci?**
