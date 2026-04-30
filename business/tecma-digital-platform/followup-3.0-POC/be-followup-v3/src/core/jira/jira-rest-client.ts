import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  token: string;
  projectKey: string;
  issueTypeStory: string;
  issueTypeSubtask: string;
}

/** Ritorna null se integrazione Jira non configurata (env mancanti). */
export function getJiraConfig(): JiraConfig | null {
  const host = ENV.JIRA_HOST.trim();
  const email = ENV.JIRA_EMAIL.trim();
  const token = ENV.JIRA_API_TOKEN.trim();
  const projectKey = ENV.JIRA_PROJECT_KEY.trim();
  if (!host || !email || !token || !projectKey) return null;
  const base = host.startsWith("http") ? host : `https://${host}`;
  return {
    baseUrl: base.replace(/\/$/, ""),
    email,
    token,
    projectKey,
    issueTypeStory: ENV.JIRA_ISSUE_TYPE_STORY.trim() || "Story",
    issueTypeSubtask: ENV.JIRA_ISSUE_TYPE_SUBTASK.trim() || "Sub-task",
  };
}

function requireJiraConfig(): JiraConfig {
  const c = getJiraConfig();
  if (!c) {
    throw new HttpError(
      "Integrazione Jira non configurata: impostare JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY",
      503,
      "JIRA_NOT_CONFIGURED"
    );
  }
  return c;
}

function authHeader(cfg: JiraConfig): string {
  const raw = `${cfg.email}:${cfg.token}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

export async function jiraCreateIssue(body: Record<string, unknown>): Promise<{ key: string; id: string }> {
  const cfg = requireJiraConfig();
  const url = `${cfg.baseUrl}/rest/api/3/issue`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(`Jira create issue: risposta non JSON (${res.status})`, 502, "JIRA_BAD_RESPONSE");
  }
  if (!res.ok) {
    logger.warn({ status: res.status, body: text }, "[jira] create issue failed");
    throw new HttpError(
      typeof (parsed as { errorMessages?: string[] })?.errorMessages?.[0] === "string"
        ? (parsed as { errorMessages: string[] }).errorMessages[0]
        : `Jira create issue fallita (${res.status})`,
      502,
      "JIRA_CREATE_FAILED"
    );
  }
  const key = String((parsed as { key?: string }).key ?? "");
  const id = String((parsed as { id?: string }).id ?? "");
  if (!key) throw new HttpError("Jira: issue creata senza key", 502, "JIRA_UNEXPECTED");
  return { key, id };
}

export interface JiraIssueStatus {
  key: string;
  summary: string;
  statusName: string;
  statusCategoryKey?: string;
  done: boolean;
}

async function jiraSearchChunk(keys: string[]): Promise<JiraIssueStatus[]> {
  const cfg = requireJiraConfig();
  const inList = keys.join(", ");
  const jql = `key in (${inList})`;
  const url = `${cfg.baseUrl}/rest/api/3/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      maxResults: Math.min(keys.length + 5, 100),
      fields: ["summary", "status"],
    }),
  });
  const text = await res.text();
  let parsed: { issues?: Array<{ key: string; fields?: { summary?: string; status?: { name?: string; statusCategory?: { key?: string } } } }> };
  try {
    parsed = text ? JSON.parse(text) : { issues: [] };
  } catch {
    throw new HttpError(`Jira search: risposta non JSON (${res.status})`, 502, "JIRA_BAD_RESPONSE");
  }
  if (!res.ok) {
    logger.warn({ status: res.status, body: text }, "[jira] search failed");
    throw new HttpError(`Jira search fallita (${res.status})`, 502, "JIRA_SEARCH_FAILED");
  }
  const issues = parsed.issues ?? [];
  return issues.map((issue) => {
    const statusName = issue.fields?.status?.name ?? "";
    const cat = issue.fields?.status?.statusCategory?.key;
    const done =
      statusName.toLowerCase() === "done" ||
      statusName.toLowerCase() === "closed" ||
      cat === "done";
    return {
      key: issue.key,
      summary: issue.fields?.summary ?? "",
      statusName,
      statusCategoryKey: cat,
      done,
    };
  });
}

const SEARCH_CHUNK = 40;

export async function jiraSearchIssuesByKeys(keys: string[]): Promise<JiraIssueStatus[]> {
  if (keys.length === 0) return [];
  const out: JiraIssueStatus[] = [];
  for (let i = 0; i < keys.length; i += SEARCH_CHUNK) {
    const chunk = keys.slice(i, i + SEARCH_CHUNK);
    const part = await jiraSearchChunk(chunk);
    out.push(...part);
  }
  return out;
}
