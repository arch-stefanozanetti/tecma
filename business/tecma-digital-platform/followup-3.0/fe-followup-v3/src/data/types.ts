import type { ApartmentRow, ClientRow, ListQuery, PaginatedResponse } from "../types/domain";

export interface CockpitFeedItem {
  id: string;
  title: string;
  summary: string;
  category: "risk" | "opportunity" | "followup";
  priority: "high" | "medium" | "low";
  cta: string;
}

export interface QuickActionPayload {
  intent: "create_task" | "send_reminder" | "open_client" | "open_apartment";
  title: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuickCommand {
  id: string;
  label: string;
  intent: QuickActionPayload["intent"];
  requiresConfirmation: boolean;
  handler: () => Promise<void>;
}

export interface ViewState {
  savedFilters: Record<string, unknown>;
  savedSort?: { field: string; direction: 1 | -1 };
  savedColumns?: string[];
  density?: "comfortable" | "compact";
}

export interface UiTokens {
  palette: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
  };
  elevation: {
    low: string;
    medium: string;
    high: string;
  };
  motion: {
    fast: string;
    normal: string;
    slow: string;
  };
  typography: {
    display: string;
    body: string;
  };
}

export interface DataAdapter {
  getCockpitFeed: (query: { workspaceId: string; projectIds: string[] }) => Promise<{ items: CockpitFeedItem[]; kpis: Record<string, number> }>;
  getClients: (query: ListQuery) => Promise<PaginatedResponse<ClientRow>>;
  getApartments: (query: ListQuery) => Promise<PaginatedResponse<ApartmentRow>>;
  runQuickAction: (payload: QuickActionPayload) => Promise<{ ok: boolean; message: string }>;
}
