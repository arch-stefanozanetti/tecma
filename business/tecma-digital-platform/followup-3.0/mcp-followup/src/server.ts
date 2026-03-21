import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { z } from "zod";

const PORT = Number(process.env.MCP_PORT || 5070);
/** Backend API base (e.g. http://localhost:8080/v1). Endpoints /clients/query, /apartments/query, /associations/query require auth. */
const API_BASE_URL = process.env.FOLLOWUP_API_BASE_URL || "http://localhost:8080/v1";
const MCP_API_KEY = (process.env.MCP_API_KEY ?? "").trim() || "change-me";
if (process.env.NODE_ENV === "production" && (!process.env.MCP_API_KEY?.trim() || MCP_API_KEY === "change-me")) {
  throw new Error("mcp-followup: in produzione impostare MCP_API_KEY (valore forte, diverso da change-me)");
}
/** Bearer token sent to Followup BE for protected endpoints. Set FOLLOWUP_BEARER_TOKEN or MCP_BEARER_TOKEN. */
const BEARER_TOKEN = process.env.FOLLOWUP_BEARER_TOKEN || process.env.MCP_BEARER_TOKEN || "";
const AUDIT_FILE = join(process.cwd(), "logs", "audit.log");

const app = express();
app.use(express.json({ limit: "1mb" }));

const requireApiKey = (req: Request, res: Response, next: () => void) => {
  const key = req.header("x-api-key");
  if (!key || key !== MCP_API_KEY) {
    res.status(403).json({ error: "Invalid MCP API key" });
    return;
  }
  next();
};

function summarizeAuditInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const o = input as Record<string, unknown>;
    const s: Record<string, unknown> = {};
    if (typeof o.workspaceId === "string") s.workspaceIdLen = o.workspaceId.length;
    if (Array.isArray(o.projectIds)) s.projectIdsCount = o.projectIds.length;
    if (typeof o.searchText === "string") s.searchTextLen = o.searchText.length;
    return s;
  }
  return {};
}

function summarizeAuditResult(result: unknown, status: "ok" | "error"): unknown {
  if (status === "error" && typeof result === "string") {
    return result.length > 240 ? `${result.slice(0, 240)}…` : result;
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const o = result as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "number") copy[k] = v;
      else if (typeof v === "boolean") copy[k] = v;
      else if (typeof v === "string") copy[k] = v.length > 64 ? `[len:${v.length}]` : v;
    }
    return copy;
  }
  if (typeof result === "number") return result;
  return "[redacted]";
}

const logAudit = async (tool: string, input: unknown, result: unknown, status: "ok" | "error") => {
  await mkdir(join(process.cwd(), "logs"), { recursive: true });
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      tool,
      status,
      inputSummary: summarizeAuditInput(input),
      resultSummary: summarizeAuditResult(result, status),
    }) + "\n";
  await appendFile(AUDIT_FILE, line, "utf8");
};

const postFollowup = async <T>(path: string, body: unknown): Promise<T> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BEARER_TOKEN) {
    headers["Authorization"] = `Bearer ${BEARER_TOKEN}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Followup API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mcp-followup" });
});

app.use(requireApiKey);

app.get("/tools", (_req, res) => {
  res.json({
    tools: [
      "search_clients",
      "search_apartments",
      "list_associations",
      "generate_workspace_report"
    ]
  });
});

app.post("/tools/search_clients", async (req, res) => {
  const schema = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1), searchText: z.string().optional().default("") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const payload = await postFollowup<{ data: unknown[]; pagination: unknown }>("/clients/query", {
      workspaceId: parsed.data.workspaceId,
      projectIds: parsed.data.projectIds,
      page: 1,
      perPage: 50,
      searchText: parsed.data.searchText,
      sort: { field: "updatedAt", direction: -1 }
    });
    await logAudit("search_clients", parsed.data, { count: payload.data.length }, "ok");
    res.json(payload);
  } catch (error) {
    await logAudit("search_clients", parsed.data, String(error), "error");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/tools/search_apartments", async (req, res) => {
  const schema = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1), searchText: z.string().optional().default("") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const payload = await postFollowup<{ data: unknown[]; pagination: unknown }>("/apartments/query", {
      workspaceId: parsed.data.workspaceId,
      projectIds: parsed.data.projectIds,
      page: 1,
      perPage: 50,
      searchText: parsed.data.searchText,
      sort: { field: "updatedAt", direction: -1 }
    });
    await logAudit("search_apartments", parsed.data, { count: payload.data.length }, "ok");
    res.json(payload);
  } catch (error) {
    await logAudit("search_apartments", parsed.data, String(error), "error");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/tools/list_associations", async (req, res) => {
  const schema = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const payload = await postFollowup<{ data: unknown[]; pagination: unknown }>("/associations/query", {
      workspaceId: parsed.data.workspaceId,
      projectIds: parsed.data.projectIds,
      page: 1,
      perPage: 100,
      searchText: "",
      sort: { field: "updatedAt", direction: -1 }
    });
    await logAudit("list_associations", parsed.data, { count: payload.data.length }, "ok");
    res.json(payload);
  } catch (error) {
    await logAudit("list_associations", parsed.data, String(error), "error");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/tools/generate_workspace_report", async (req, res) => {
  const schema = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const [clients, apartments, associations] = await Promise.all([
      postFollowup<{ data: unknown[] }>("/clients/query", {
        workspaceId: parsed.data.workspaceId,
        projectIds: parsed.data.projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      postFollowup<{ data: Array<{ status?: string }> }>("/apartments/query", {
        workspaceId: parsed.data.workspaceId,
        projectIds: parsed.data.projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      postFollowup<{ data: Array<{ status?: string }> }>("/associations/query", {
        workspaceId: parsed.data.workspaceId,
        projectIds: parsed.data.projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
    ]);

    const report = {
      workspaceId: parsed.data.workspaceId,
      projects: parsed.data.projectIds,
      snapshotAt: new Date().toISOString(),
      metrics: {
        clients: clients.data.length,
        apartments: apartments.data.length,
        availableApartments: apartments.data.filter((row) => row.status === "AVAILABLE").length,
        associations: associations.data.length,
        progressedDeals: associations.data.filter((row) => row.status && row.status !== "proposta").length
      }
    };

    await logAudit("generate_workspace_report", parsed.data, report.metrics, "ok");
    res.json(report);
  } catch (error) {
    await logAudit("generate_workspace_report", parsed.data, String(error), "error");
    res.status(500).json({ error: (error as Error).message });
  }
});

export { app };

if (typeof process.env.VITEST === "undefined") {
  app.listen(PORT, () => {
    console.log(`mcp-followup listening on :${PORT}`);
  });
}
