import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { plainTextToAdf } from "../jira/jira-adf.js";
import { getJiraConfig, jiraCreateIssue, jiraSearchIssuesByKeys } from "../jira/jira-rest-client.js";
import { FEATURE_CATALOG, type DisciplineId, type FeatureCatalogEntry } from "./feature-catalog.js";

const COLLECTION = "tz_jira_prd_links";

export interface JiraPrdLinkDoc {
  idTema: string;
  storyKey: string;
  subtaskKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

function labelForIdTema(idTema: string): string {
  return `idTema_${idTema.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function buildStoryDescription(entry: FeatureCatalogEntry, parent: FeatureCatalogEntry | null): string {
  const links = entry.docLinks.map((d) => `- ${d.label}: ${d.href}`).join("\n");
  const pr = entry.prd;
  const prdBlock = [
    "## PRD",
    "### Problema / job-to-be-done",
    pr.problemJob,
    "### Comportamento atteso",
    pr.expectedBehavior,
    "### Non-goals",
    pr.nonGoals,
    "### Dati (Mongo / persistenza)",
    pr.dataMongo,
    "### Permessi e entitlement",
    pr.permissionsEntitlement,
    "### Failure modes",
    pr.failureModes,
    "### Prove QA / test",
    pr.qaProofs,
  ].join("\n");
  const context =
    entry.kind === "technical" && parent
      ? [
          "## Contesto",
          `Voce **technical** collegata alla capability: **${parent.title}** (\`${parent.idTema}\`).`,
          "",
        ].join("\n")
      : "";
  const epicBacklog = [
    "## Epic / backlog",
    `- **Epic:** ${entry.epicId} — ${entry.epicTitle}`,
    `- **Tipo issue suggerito:** ${entry.workItemKind}`,
    ...(entry.storyRef ? [`- **Story ref (blueprint):** ${entry.storyRef}`] : []),
    ...(entry.designRefs?.length ? [`- **Design / UX:** ${entry.designRefs.join(", ")}`] : []),
    "",
  ].join("\n");

  return [
    context,
    "## Sintesi",
    entry.summary,
    "",
    epicBacklog,
    prdBlock,
    "",
    "## Documentazione",
    links,
    "",
    "## Frontend (dettaglio implementativo)",
    entry.disciplines.frontend,
    "",
    "## Backend",
    entry.disciplines.backend,
    "",
    "## Database",
    entry.disciplines.database,
    "",
    "## UX/UI",
    entry.disciplines.uxUi,
    "",
    "## QA",
    entry.disciplines.qa,
    "",
    "## Test automatici",
    entry.disciplines.test,
    "",
    "---",
    "Generato da Followup 3.0 Product Blueprint (PRD).",
  ].join("\n");
}

const SUBTASK_PREFIX: Record<DisciplineId, string> = {
  frontend: "[FE]",
  backend: "[BE]",
  database: "[DB]",
  uxUi: "[UX]",
  qa: "[QA]",
  test: "[Test]",
};

export function getFeatureCatalog(): FeatureCatalogEntry[] {
  return FEATURE_CATALOG;
}

export function getCatalogForApi(): { data: FeatureCatalogEntry[] } {
  return { data: FEATURE_CATALOG };
}

export async function findLink(idTema: string): Promise<JiraPrdLinkDoc | null> {
  const db = getDb();
  const doc = await db.collection<JiraPrdLinkDoc>(COLLECTION).findOne({ idTema });
  return doc;
}

export async function publishSelections(input: {
  idTemaList: string[];
  force?: boolean;
}): Promise<{
  data: {
    created: Array<{ idTema: string; storyKey: string; subtaskKeys: string[] }>;
    skipped: Array<{ idTema: string; reason: string }>;
  };
}> {
  const cfg = getJiraConfig();
  if (!cfg) {
    throw new HttpError(
      "Integrazione Jira non configurata: impostare JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY",
      503,
      "JIRA_NOT_CONFIGURED"
    );
  }

  const byId = new Map(FEATURE_CATALOG.map((e) => [e.idTema, e]));
  const created: Array<{ idTema: string; storyKey: string; subtaskKeys: string[] }> = [];
  const skipped: Array<{ idTema: string; reason: string }> = [];
  const db = getDb();
  const now = new Date();

  for (const idTema of input.idTemaList) {
    const entry = byId.get(idTema);
    if (!entry) {
      skipped.push({ idTema, reason: "unknown_idTema" });
      continue;
    }
    const existing = await findLink(idTema);
    if (existing && !input.force) {
      skipped.push({ idTema, reason: "already_published_use_force" });
      continue;
    }
    if (existing && input.force) {
      await db.collection(COLLECTION).deleteOne({ idTema });
    }

    const parent = entry.parentIdTema ? byId.get(entry.parentIdTema) ?? null : null;
    const storySummary =
      entry.kind === "technical" && parent
        ? `${entry.areaPrefix} [↑${parent.idTema}] ${entry.title}`.trim()
        : `${entry.areaPrefix} ${entry.title}`.trim();
    const labels = ["followup-3.0", labelForIdTema(idTema)];

    const storyBody = {
      fields: {
        project: { key: cfg.projectKey },
        summary: storySummary.slice(0, 240),
        description: plainTextToAdf(buildStoryDescription(entry, parent)),
        issuetype: { name: cfg.issueTypeStory },
        labels,
      },
    };

    const { key: storyKey } = await jiraCreateIssue(storyBody);
    const subtaskKeys: string[] = [];
    const order: DisciplineId[] = ["frontend", "backend", "database", "uxUi", "qa", "test"];

    const subPrefix =
      entry.kind === "technical" && parent ? `[↑${parent.idTema}] ` : "";

    for (const d of order) {
      const st = await jiraCreateIssue({
        fields: {
          project: { key: cfg.projectKey },
          parent: { key: storyKey },
          summary: `${SUBTASK_PREFIX[d]} ${subPrefix}${entry.title}`.slice(0, 240),
          description: plainTextToAdf(entry.disciplines[d]),
          issuetype: { name: cfg.issueTypeSubtask },
          labels,
        },
      });
      subtaskKeys.push(st.key);
    }

    await db.collection<JiraPrdLinkDoc>(COLLECTION).updateOne(
      { idTema },
      {
        $set: {
          idTema,
          storyKey,
          subtaskKeys,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    created.push({ idTema, storyKey, subtaskKeys });
  }

  return { data: { created, skipped } };
}

export interface StatusRow {
  idTema: string;
  storyKey: string | null;
  subtaskKeys: string[];
  issues: Array<{
    key: string;
    summary: string;
    statusName: string;
    done: boolean;
  }>;
  allDone: boolean;
}

export async function getPublishStatus(): Promise<{
  data: { jiraConfigured: boolean; jiraBrowseBase: string | null; rows: StatusRow[] };
}> {
  const cfg = getJiraConfig();
  if (!cfg) {
    return { data: { jiraConfigured: false, jiraBrowseBase: null, rows: [] } };
  }
  const browseBase = `${cfg.baseUrl}/browse`;

  const db = getDb();
  const links = await db.collection<JiraPrdLinkDoc>(COLLECTION).find({}).toArray();
  const allKeys = new Set<string>();
  for (const l of links) {
    if (l.storyKey) allKeys.add(l.storyKey);
    for (const k of l.subtaskKeys ?? []) allKeys.add(k);
  }

  const statuses = await jiraSearchIssuesByKeys([...allKeys]);
  const byKey = new Map(statuses.map((s) => [s.key, s]));

  const rows: StatusRow[] = links.map((l) => {
    const keys = [l.storyKey, ...(l.subtaskKeys ?? [])].filter(Boolean) as string[];
    const issues = keys.map((key) => {
      const s = byKey.get(key);
      return {
        key,
        summary: s?.summary ?? "",
        statusName: s?.statusName ?? "unknown",
        done: s?.done ?? false,
      };
    });
    const allDone = issues.length > 0 && issues.every((i) => i.done);
    return {
      idTema: l.idTema,
      storyKey: l.storyKey ?? null,
      subtaskKeys: l.subtaskKeys ?? [],
      issues,
      allDone,
    };
  });

  return { data: { jiraConfigured: true, jiraBrowseBase: browseBase, rows } };
}
