/**
 * Tipi catalogo PRD ibrido: capability prodotto vs dettaglio tecnico, template testuale obbligatorio.
 */
import type { CatalogWorkItemKind, EpicId } from "./epic-registry.js";
import { EPIC_TITLES } from "./epic-registry.js";
import { getEpicMetaForIdTema } from "./id-tema-epic-map.js";

export type { CatalogWorkItemKind, EpicId } from "./epic-registry.js";

export type DisciplineId = "frontend" | "backend" | "database" | "uxUi" | "qa" | "test";

export type AreaPrefix = "[Cross]" | "[Sell]" | "[Rent]" | "[QA]" | "[iTd]";

export type CatalogEntryKind = "product" | "technical";

/** Campi PRD minimi (anti-scarsità): ogni voce pubblicabile deve poter riempire queste sezioni. */
export interface PrdTemplate {
  /** Problema utente / job-to-be-done */
  problemJob: string;
  /** Comportamento atteso (happy path, outcome misurabile) */
  expectedBehavior: string;
  /** Cosa è esplicitamente fuori scope */
  nonGoals: string;
  /** Dati Mongo / persistenza rilevante */
  dataMongo: string;
  /** Permessi JWT, entitlement commerciale, gate Tecma */
  permissionsEntitlement: string;
  /** Failure modes tipici (API, rete, permessi, dati inconsistenti) */
  failureModes: string;
  /** Prove QA minime / test automatici attesi */
  qaProofs: string;
}

export interface FeatureCatalogEntry {
  idTema: string;
  kind: CatalogEntryKind;
  /** Se presente, punta a idTema del nodo padre (di solito kind product) */
  parentIdTema?: string;
  /** Epic TECMA (E1–E14), allineata a JIRA_TRACEABILITY §5 */
  epicId: EpicId;
  /** Titolo Epic denormalizzato (stesso significato di epicId) */
  epicTitle: string;
  /** Story / Spike / Task / technical (suggerimento pubblicazione Jira) */
  workItemKind: CatalogWorkItemKind;
  /** Riferimento opzionale a Story/Spike nel blueprint (es. S1.1, SP13.1) */
  storyRef?: string;
  /** Path o label documenti UX / FASE per designer */
  designRefs?: string[];
  areaPrefix: AreaPrefix;
  title: string;
  summary: string;
  prd: PrdTemplate;
  docLinks: { label: string; href: string }[];
  disciplines: Record<DisciplineId, string>;
}

/** Input authoring: kind/prd/epic opzionali, valorizzati da enrichRow */
export type CatalogRowInput = Omit<FeatureCatalogEntry, "kind" | "prd" | "epicId" | "epicTitle" | "workItemKind"> & {
  kind?: CatalogEntryKind;
  parentIdTema?: string;
  prd?: Partial<PrdTemplate>;
  epicId?: EpicId;
  epicTitle?: string;
  workItemKind?: CatalogWorkItemKind;
  storyRef?: string;
  designRefs?: string[];
};

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}… [testo troncato; vedi sezione Discipline per il dettaglio completo]`;
}

export function mergePrd(
  partial: Partial<PrdTemplate> | undefined,
  ctx: Pick<FeatureCatalogEntry, "title" | "summary" | "disciplines">
): PrdTemplate {
  const d = ctx.disciplines;
  const title = ctx.title.trim();

  const problemJob =
    partial?.problemJob ??
    [
      `Contesto utente: operatori commerciali e back-office che lavorano in contesto multi-workspace e multi-progetto.`,
      `Problema da risolvere: "${title}" deve essere disponibile in modo prevedibile, auditabile e sicuro: nessun accesso a dati di altri workspace, nessuna azione senza permesso JWT, nessuna scrittura che corrompa invarianti di dominio.`,
      `Valore atteso: riduzione tempo operativo, meno errori manuali, tracciabilità delle modifiche dove previsto dal dominio.`,
      `Riferimento implementativo: allineare UI, API e persistenza alle discipline sotto (FE/BE/DB/UX/QA/Test).`,
    ].join("\n");

  const expectedBehavior =
    partial?.expectedBehavior ??
    [
      `Comportamento funzionale (sintesi): ${ctx.summary}`,
      `Happy path: l’utente autorizzato apre il flusso dalla UI Followup 3.0, completa i passi senza errori bloccanti, e vede il risultato coerente con i dati persistiti (refresh o evento realtime se applicabile).`,
      `Criteri di accettazione impliciti: coerenza tra ciò che mostra la UI e ciò che restituiscono le API; messaggi di errore comprensibili; nessun dato sensibile in log o risposte non necessarie.`,
    ].join("\n");

  const nonGoals =
    partial?.nonGoals ??
    [
      `Non in scope senza nuova decisione di prodotto: codice e deploy fuori dagli alberi canonici followup-3.0 (be-followup-v3 / fe-followup-v3 / mcp-followup opzionale).`,
      `Non in scope: bypass di autenticazione/autorizzazione, esposizione di segreti (token Jira, chiavi API, connection string) in FE o in issue pubbliche.`,
      `Non in scope: integrazioni esterne non governate da entitlement e da policy sicurezza (Twilio, API platform, marketing) salvo che la capability lo dichiari esplicitamente.`,
      `Non in scope: migrazione massiva dati legacy o ETL di produzione senza runbook e pilota concordati.`,
    ].join("\n");

  const dataMongo =
    partial?.dataMongo ??
    [
      `Persistenza MongoDB (e modelli tz_* dove applicabile):`,
      d.database,
      ``,
      `Indici e query: devono supportare filtri per workspaceId e projectId senza full collection scan su tenant grandi; evitare race su aggiornamenti concorrenti dove il dominio richiede serializzazione.`,
      `Coerenza: ogni scrittura deve rispettare i vincoli di dominio (chi può creare/cancellare, soft delete vs hard delete, retention notifiche/audit).`,
    ].join("\n");

  const permissionsEntitlement =
    partial?.permissionsEntitlement ??
    [
      `RBAC: ogni route protetta deve usare i permessi JWT per modulo/azione (es. clients.read, apartments.update, settings.read, ecc.); admin e wildcard * gestiti come da policy esistente.`,
      `Entitlement commerciale: dove la capability tocca Twilio, Public API, Mailchimp/ActiveCampaign o moduli a pagamento, verificare tz_workspace_entitlements e i middleware di enforcement lato BE.`,
      `Console Tecma: funzioni riservate a isTecmaAdmin restano inaccessibili agli utenti workspace standard.`,
      `Dettaglio tecnico API e servizi (estratto dalla disciplina Backend):`,
      clip(d.backend, 2500),
    ].join("\n");

  const failureModes =
    partial?.failureModes ??
    [
      `Autenticazione/sessione: token assente, scaduto o revocato → 401 e redirect/login; refresh fallito → messaggio chiaro.`,
      `Autorizzazione: permesso mancante o entitlement disattivato → 403 con codice/hint dove previsto; niente stack trace in risposta.`,
      `Validazione: input Zod/schema → 400 con dettaglio campo; evitare 500 per errori di validazione.`,
      `Dominio: risorsa assente o ID progetto/workspace non coerente con lo scope utente → 404 o 403 a seconda della policy.`,
      `Concurrenza: due utenti aggiornano la stessa entità → ultimo write vince o conflitto esplicito secondo implementazione.`,
      `Dipendenze esterne: timeout, rate limit, provider down → errore tracciato lato log, messaggio utente non tecnico.`,
      `Indicazioni QA (dalla disciplina QA):`,
      d.qa,
    ].join("\n");

  const qaProofs =
    partial?.qaProofs ??
    [
      `Verifiche manuali minime (staging): happy path per ruolo viewer e admin; tentativo accesso senza permesso; verifica dati dopo refresh pagina.`,
      `QA funzionale (disciplina QA):`,
      d.qa,
      ``,
      `Test automatici (disciplina Test):`,
      d.test,
      ``,
      `UX: stati vuoti, loading, errori di rete, accessibilità base sui controlli critici (dove la disciplina UX/UI lo richiede).`,
    ].join("\n");

  return {
    problemJob,
    expectedBehavior,
    nonGoals,
    dataMongo,
    permissionsEntitlement,
    failureModes,
    qaProofs,
  };
}

export function enrichRow(row: CatalogRowInput): FeatureCatalogEntry {
  const kind = row.kind ?? "product";
  const prd = mergePrd(row.prd, row);
  const meta = getEpicMetaForIdTema(row.idTema);
  const epicId = row.epicId ?? meta.epicId;
  const workItemKind: CatalogWorkItemKind =
    kind === "technical" ? "technical" : (row.workItemKind ?? meta.workItemKind);
  return {
    ...row,
    kind,
    parentIdTema: row.parentIdTema,
    prd,
    epicId,
    epicTitle: row.epicTitle ?? EPIC_TITLES[epicId],
    workItemKind,
    storyRef: row.storyRef ?? meta.storyRef,
    designRefs: row.designRefs ?? meta.designRefs,
  };
}
