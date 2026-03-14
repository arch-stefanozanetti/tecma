import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { followupApi } from "../../api/followupApi";
import { isSectionEnabledByFeature, isPriceAvailabilityRelevant } from "../features";
import type {
  ProjectAccessProject,
  ClientRow,
  ApartmentRow,
  RequestRow,
  PaginatedResponse,
} from "../../types/domain";

export type Section =
  | "cockpit"
  | "calendar"
  | "clients"
  | "apartments"
  | "requests"
  | "projects"
  | "inbox"
  | "customer360"
  | "workspaces"
  | "users"
  | "audit"
  | "reports"
  | "releases"
  | "integrations"
  | "priceAvailability";

export interface CommandSectionItem {
  kind: "section";
  id: Section;
  label: string;
  hint: string;
}

export interface CommandEntityItem {
  kind: "entity";
  type: "client" | "apartment" | "request";
  id: string;
  label: string;
  subtitle?: string;
}

export type CommandItem = CommandSectionItem | CommandEntityItem;

const SECTION_COMMANDS: CommandSectionItem[] = [
  { kind: "section", id: "cockpit", label: "Home", hint: "Cockpit e priorità" },
  { kind: "section", id: "clients", label: "Clienti", hint: "Lista clienti" },
  { kind: "section", id: "apartments", label: "Appartamenti", hint: "Lista appartamenti" },
  { kind: "section", id: "requests", label: "Trattative", hint: "Pipeline vendita/affitto" },
  { kind: "section", id: "calendar", label: "Calendario", hint: "Agenda" },
  { kind: "section", id: "inbox", label: "Inbox", hint: "Notifiche e promemoria" },
  { kind: "section", id: "customer360", label: "Customer 360", hint: "Vista aggregata clienti e trattative" },
  { kind: "section", id: "projects", label: "Progetti", hint: "Lista progetti" },
  { kind: "section", id: "priceAvailability", label: "Prezzi e disponibilità", hint: "Matrice prezzi" },
  { kind: "section", id: "integrations", label: "Integrazioni e automazioni", hint: "Connettori, regole, webhook, API" },
  { kind: "section", id: "reports", label: "Report", hint: "Pipeline, clienti, appartamenti" },
  { kind: "section", id: "releases", label: "Release", hint: "Novità e cronologia release" },
  { kind: "section", id: "workspaces", label: "Workspaces", hint: "Gestione workspace (admin)" },
  { kind: "section", id: "users", label: "User", hint: "Utenti e visibilità (admin)" },
  { kind: "section", id: "audit", label: "Audit log", hint: "Tracciamento CRUD (admin)" },
];

const ENTITY_LIMIT = 5;
const DEBOUNCE_MS = 250;

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: Section) => void;
  /** Navigate to entity detail (used when selecting a client/apartment/request from search). */
  navigate: (path: string) => void;
  workspaceId: string;
  projectIds: string[];
  /** Feature abilitate per il workspace (undefined = tutte). Nasconde comandi non abilitati. */
  enabledFeatures?: string[];
  isAdmin?: boolean;
  projects?: ProjectAccessProject[];
  selectedProjectIds?: string[];
}

export const CommandPalette = ({
  isOpen,
  onClose,
  onSelectSection,
  navigate,
  workspaceId,
  projectIds,
  enabledFeatures,
  isAdmin = false,
  projects = [],
  selectedProjectIds = [],
}: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [clients, setClients] = useState<Array<{ _id: string; fullName: string; email?: string }>>([]);
  const [apartments, setApartments] = useState<Array<{ _id: string; name: string; code?: string }>>([]);
  const [requests, setRequests] = useState<Array<{ _id: string; clientName?: string; apartmentCode?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, isOpen]);

  const visibleSectionCommands = useMemo(() => {
    return SECTION_COMMANDS.filter((item) => {
      if (item.id === "workspaces" || item.id === "users" || item.id === "audit") {
        if (!isAdmin) return false;
      }
      if (!isSectionEnabledByFeature(item.id, enabledFeatures)) return false;
      if (item.id === "priceAvailability" && projects.length > 0 && selectedProjectIds.length > 0) {
        if (!isPriceAvailabilityRelevant(projects, selectedProjectIds)) return false;
      }
      return true;
    });
  }, [enabledFeatures, isAdmin, projects, selectedProjectIds]);

  const filteredSectionCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleSectionCommands;
    return visibleSectionCommands.filter(
      (item) =>
        `${item.label} ${item.hint}`.toLowerCase().includes(needle)
    );
  }, [query, visibleSectionCommands]);

  useEffect(() => {
    const q = debouncedQuery;
    if (!isOpen || !workspaceId || projectIds.length === 0) {
      setClients([]);
      setApartments([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    if (!q) {
      setClients([]);
      setApartments([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const listQuery = {
      workspaceId,
      projectIds,
      page: 1,
      perPage: ENTITY_LIMIT,
      searchText: q,
      sort: { field: "updatedAt", direction: -1 as 1 | -1 },
      filters: {},
    };
    Promise.all([
      followupApi.queryClients(listQuery),
      followupApi.queryApartments(listQuery),
      followupApi.queryRequests(listQuery),
    ])
      .then(([cRes, aRes, rRes]: [PaginatedResponse<ClientRow>, PaginatedResponse<ApartmentRow>, PaginatedResponse<RequestRow>]) => {
        setClients((cRes.data ?? []).map((row: ClientRow) => ({ _id: row._id, fullName: row.fullName, email: row.email })));
        setApartments((aRes.data ?? []).map((row: ApartmentRow) => ({ _id: row._id, name: row.name, code: row.code })));
        setRequests((rRes.data ?? []).map((row: RequestRow) => ({ _id: row._id, clientName: row.clientName, apartmentCode: row.apartmentCode, status: row.status })));
      })
      .catch(() => {
        setClients([]);
        setApartments([]);
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, isOpen, workspaceId, projectIds]);

  const entityItems: CommandEntityItem[] = useMemo(() => {
    const items: CommandEntityItem[] = [];
    clients.forEach((c) => {
      items.push({ kind: "entity", type: "client", id: c._id, label: c.fullName, subtitle: c.email });
    });
    apartments.forEach((a) => {
      items.push({ kind: "entity", type: "apartment", id: a._id, label: a.name, subtitle: a.code });
    });
    requests.forEach((r) => {
      const sub = [r.clientName, r.apartmentCode].filter(Boolean).join(" · ") || r.status;
      items.push({ kind: "entity", type: "request", id: r._id, label: sub || r._id.slice(-6), subtitle: sub ? undefined : r._id });
    });
    return items;
  }, [clients, apartments, requests]);

  const allItems: CommandItem[] = useMemo(
    () => [...filteredSectionCommands, ...entityItems],
    [filteredSectionCommands, entityItems]
  );

  useEffect(() => {
    setHighlightedIndex((i) => (allItems.length === 0 ? 0 : Math.min(i, allItems.length - 1)));
  }, [allItems.length]);

  const selectItem = useCallback(
    (item: CommandItem) => {
      if (item.kind === "section") {
        onSelectSection(item.id);
        onClose();
        return;
      }
      if (item.kind === "entity") {
        onClose();
        if (item.type === "client") navigate(`/clients/${item.id}`);
        else if (item.type === "apartment") navigate(`/apartments/${item.id}`);
        else onSelectSection("requests");
      }
    },
    [onSelectSection, onClose, navigate]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i < allItems.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : allItems.length - 1));
        return;
      }
      if (e.key === "Enter" && allItems[highlightedIndex]) {
        e.preventDefault();
        selectItem(allItems[highlightedIndex]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allItems, highlightedIndex, onClose, selectItem]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector(`[data-command-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ricerca globale"
        aria-modal="true"
      >
        <Input
          ref={inputRef}
          placeholder="Digita un comando o cerca cliente, appartamento, trattativa... (Ctrl/Cmd + K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
          aria-activedescendant={allItems[highlightedIndex] ? `command-item-${highlightedIndex}` : undefined}
        />
        <div
          id="command-palette-list"
          ref={listRef}
          className="command-list"
          role="listbox"
          aria-label="Risultati"
        >
          {filteredSectionCommands.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vai a
              </div>
              {filteredSectionCommands.map((item, idx) => {
                const globalIndex = allItems.indexOf(item);
                const isHighlighted = globalIndex === highlightedIndex;
                return (
                  <button
                    key={`section-${item.id}`}
                    type="button"
                    data-command-index={globalIndex}
                    id={isHighlighted ? `command-item-${globalIndex}` : undefined}
                    role="option"
                    aria-selected={isHighlighted}
                    className={cn("command-item", isHighlighted && "command-item-highlighted")}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </button>
                );
              })}
            </>
          )}
          {entityItems.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Risultati
              </div>
              {entityItems.map((item) => {
                const globalIndex = allItems.indexOf(item);
                const isHighlighted = globalIndex === highlightedIndex;
                const typeLabel = item.type === "client" ? "Cliente" : item.type === "apartment" ? "Appartamento" : "Trattativa";
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    data-command-index={globalIndex}
                    id={isHighlighted ? `command-item-${globalIndex}` : undefined}
                    role="option"
                    aria-selected={isHighlighted}
                    className={cn("command-item", isHighlighted && "command-item-highlighted")}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.subtitle ? `${typeLabel}: ${item.subtitle}` : typeLabel}</span>
                  </button>
                );
              })}
            </>
          )}
          {loading && <p className="generic-table-feedback">Ricerca in corso...</p>}
          {!loading && allItems.length === 0 && <p className="generic-table-feedback">Nessun comando o risultato trovato.</p>}
        </div>
      </div>
    </div>
  );
};
