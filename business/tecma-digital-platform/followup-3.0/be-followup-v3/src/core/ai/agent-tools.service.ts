/**
 * Tool in-process per l'agente AI (stessa semantica di mcp-followup, senza HTTP).
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { queryClients } from "../clients/clients.service.js";
import { queryApartments } from "../apartments/apartments.service.js";
import type { EntityAssignmentListViewer } from "../workspaces/entity-assignment-query.util.js";
import { queryAssociations } from "../future/future.service.js";
import { createCalendarEvent } from "../calendar/calendar.service.js";

export type AgentToolContext = {
  workspaceId: string;
  projectIds: string[];
  actorEmail: string;
  /** Allineamento al filtro entity assignments sulle liste CRM */
  actorIsAdmin?: boolean;
  actorIsTecmaAdmin?: boolean;
};

function toolListViewer(ctx: AgentToolContext): EntityAssignmentListViewer {
  return {
    email: ctx.actorEmail,
    isAdmin: ctx.actorIsAdmin === true,
    isTecmaAdmin: ctx.actorIsTecmaAdmin === true,
  };
}

function assertWorkspace(ctx: AgentToolContext, workspaceId: string): void {
  if (workspaceId !== ctx.workspaceId) {
    throw new HttpError("Tool workspaceId must match suggestion workspace", 400);
  }
}

function filterProjectIds(ctx: AgentToolContext, ids: string[]): string[] {
  const set = new Set(ctx.projectIds);
  return ids.filter((id) => set.has(id));
}

const SearchSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  searchText: z.string().optional().default("")
});

const ListAssocSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1)
});

const ReportSchema = ListAssocSchema;

const CreateCalendarSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  clientId: z.string().optional(),
  apartmentId: z.string().optional()
});

const CreateTaskSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  clientId: z.string().optional(),
  apartmentId: z.string().optional(),
  dueAt: z.string().optional()
});

export const AGENT_TOOL_NAMES = [
  "search_clients",
  "search_apartments",
  "list_associations",
  "generate_workspace_report",
  "create_calendar_event",
  "create_task_from_suggestion"
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export function isAgentToolName(name: string): name is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

export async function executeAgentTool(
  name: AgentToolName,
  args: unknown,
  ctx: AgentToolContext
): Promise<unknown> {
  switch (name) {
    case "search_clients": {
      const p = SearchSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      const projectIds = filterProjectIds(ctx, p.projectIds);
      if (projectIds.length === 0) throw new HttpError("Invalid projectIds for workspace", 400);
      return queryClients(
        {
          workspaceId: p.workspaceId,
          projectIds,
          page: 1,
          perPage: 50,
          searchText: p.searchText,
          sort: { field: "updatedAt", direction: -1 },
          filters: {},
        },
        toolListViewer(ctx)
      );
    }
    case "search_apartments": {
      const p = SearchSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      const projectIds = filterProjectIds(ctx, p.projectIds);
      if (projectIds.length === 0) throw new HttpError("Invalid projectIds for workspace", 400);
      return queryApartments(
        {
          workspaceId: p.workspaceId,
          projectIds,
          page: 1,
          perPage: 50,
          searchText: p.searchText,
          sort: { field: "updatedAt", direction: -1 },
          filters: {},
        },
        toolListViewer(ctx)
      );
    }
    case "list_associations": {
      const p = ListAssocSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      const projectIds = filterProjectIds(ctx, p.projectIds);
      if (projectIds.length === 0) throw new HttpError("Invalid projectIds for workspace", 400);
      return queryAssociations({
        workspaceId: p.workspaceId,
        projectIds,
        page: 1,
        perPage: 100,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
        filters: {}
      });
    }
    case "generate_workspace_report": {
      const p = ReportSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      const projectIds = filterProjectIds(ctx, p.projectIds);
      if (projectIds.length === 0) throw new HttpError("Invalid projectIds for workspace", 400);
      const [clients, apartments, associations] = await Promise.all([
        queryClients(
          {
            workspaceId: p.workspaceId,
            projectIds,
            page: 1,
            perPage: 200,
            searchText: "",
            sort: { field: "updatedAt", direction: -1 },
            filters: {},
          },
          toolListViewer(ctx)
        ),
        queryApartments(
          {
            workspaceId: p.workspaceId,
            projectIds,
            page: 1,
            perPage: 200,
            searchText: "",
            sort: { field: "updatedAt", direction: -1 },
            filters: {},
          },
          toolListViewer(ctx)
        ),
        queryAssociations({
          workspaceId: p.workspaceId,
          projectIds,
          page: 1,
          perPage: 200,
          searchText: "",
          sort: { field: "updatedAt", direction: -1 },
          filters: {}
        })
      ]);
      const aptRows = apartments.data as Array<{ status?: string }>;
      return {
        workspaceId: p.workspaceId,
        projects: projectIds,
        snapshotAt: new Date().toISOString(),
        metrics: {
          clients: clients.data.length,
          apartments: apartments.data.length,
          availableApartments: aptRows.filter((row) => row.status === "AVAILABLE").length,
          associations: associations.data.length,
          progressedDeals: (associations.data as Array<{ status?: string }>).filter(
            (row) => row.status && row.status !== "proposta"
          ).length
        }
      };
    }
    case "create_calendar_event": {
      const p = CreateCalendarSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      if (!ctx.projectIds.includes(p.projectId)) throw new HttpError("projectId not in workspace scope", 400);
      return createCalendarEvent({
        workspaceId: p.workspaceId,
        projectId: p.projectId,
        title: p.title,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        source: "CUSTOM_SERVICE",
        ...(p.clientId?.trim() && { clientId: p.clientId.trim() }),
        ...(p.apartmentId?.trim() && { apartmentId: p.apartmentId.trim() })
      });
    }
    case "create_task_from_suggestion": {
      const p = CreateTaskSchema.parse(args);
      assertWorkspace(ctx, p.workspaceId);
      if (!ctx.projectIds.includes(p.projectId)) throw new HttpError("projectId not in workspace scope", 400);
      const db = getDb();
      const now = new Date().toISOString();
      const taskDoc = {
        workspaceId: p.workspaceId,
        projectId: p.projectId,
        title: p.title,
        description: p.description,
        target: {
          ...(p.clientId?.trim() && { clientId: p.clientId.trim() }),
          ...(p.apartmentId?.trim() && { apartmentId: p.apartmentId.trim() })
        },
        source: "ai_suggestion_agent",
        status: "open",
        dueAt: p.dueAt ?? null,
        createdBy: ctx.actorEmail,
        createdAt: now,
        updatedAt: now
      };
      const inserted = await db.collection("tz_tasks").insertOne(taskDoc);
      return { taskId: inserted.insertedId.toHexString() };
    }
    default: {
      const _exhaustive: never = name;
      throw new HttpError(`Unknown tool: ${_exhaustive}`, 400);
    }
  }
}
