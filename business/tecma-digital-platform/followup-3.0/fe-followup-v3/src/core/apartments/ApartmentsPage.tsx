import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Download,
  ExternalLink,
  Filter,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { usePaginatedList } from "../shared/usePaginatedList";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { FiltersDrawer } from "../../components/ui/filters-drawer";

type ModeFilter = "all" | "SELL" | "RENT";

const MODE_TABS: { id: ModeFilter; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "SELL", label: "Vendita" },
  { id: "RENT", label: "Affitto" },
];

/** Valori status per filtro API (AVAILABLE, RESERVED, SOLD, RENTED) */
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
  { value: "AVAILABLE", label: "Disponibile" },
  { value: "RESERVED", label: "Riservato" },
  { value: "SOLD", label: "Venduto" },
  { value: "RENTED", label: "Affittato" },
];

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const pseudoFloor = (code: string) => {
  const codeSum = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (codeSum % 8) + 1;
};

const roomLabel = (surfaceMq: number) => {
  if (surfaceMq < 50) return "Monolocale";
  if (surfaceMq < 75) return "Trilocale";
  return "Quadrilocale";
};

const availabilityInfo = (status: ApartmentRow["status"]) =>
  status === "AVAILABLE"
    ? { label: "Disponibile", className: "text-primary" }
    : { label: "Non disponibile", className: "text-destructive" };

const statusLabelMap: Record<ApartmentRow["status"], string> = {
  AVAILABLE: "Disponibile",
  RESERVED: "Riservato",
  SOLD: "Venduto",
  RENTED: "Affittato",
};

const statusInfo = (apt: ApartmentRow) => {
  if (apt.mode === "RENT") return { label: "Affitto", dot: "#8878C6" };
  if (apt.status === "AVAILABLE") return { label: "Disponibile", dot: "#65BFAF" };
  return { label: "Proposta", dot: "#F1904F" };
};

const APARTMENTS_PER_PAGE = 10;

export const ApartmentsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds } = useWorkspace();
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApartment, setSelectedApartment] = useState<ApartmentRow | null>(null);
  const [showDetailMore, setShowDetailMore] = useState(false);
  const [editApartmentOpen, setEditApartmentOpen] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<ApartmentRow["status"]>("AVAILABLE");
  const [editSurfaceMq, setEditSurfaceMq] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [otherOptionsOpen, setOtherOptionsOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState("all");
  const otherOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filtersDrawerOpen) setStatusDraft(statusFilter);
  }, [filtersDrawerOpen, statusFilter]);

  const filters = useMemo<Record<string, unknown>>(
    () => {
      const f: Record<string, unknown> = {};
      if (modeFilter !== "all") f.mode = [modeFilter];
      if (statusFilter !== "all") f.status = [statusFilter];
      return f;
    },
    [modeFilter, statusFilter]
  );

  const {
    data: apartments,
    total,
    page,
    setPage,
    searchText: committedSearch,
    setSearchText: setCommittedSearch,
    isLoading,
    error,
    refetch,
  } = usePaginatedList<ApartmentRow>({
    loader: followupApi.queryApartments,
    workspaceId: workspaceId ?? "",
    projectIds: selectedProjectIds,
    defaultSortField: "updatedAt",
    defaultPerPage: APARTMENTS_PER_PAGE,
    filters,
    enabled: !!(workspaceId && selectedProjectIds.length > 0),
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (otherOptionsRef.current && !otherOptionsRef.current.contains(e.target as Node)) {
        setOtherOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = () => {
    setCommittedSearch(search);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCommittedSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  useEffect(() => {
    if (editApartmentOpen && selectedApartment) {
      setEditCode(selectedApartment.code);
      setEditName(selectedApartment.name ?? "");
      setEditStatus(selectedApartment.status);
      setEditSurfaceMq(String(selectedApartment.surfaceMq ?? ""));
      setEditError(null);
    }
  }, [editApartmentOpen, selectedApartment]);

  const handleEditApartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const surfaceMq = Number(editSurfaceMq);
      if (Number.isNaN(surfaceMq) || surfaceMq < 0) {
        setEditError("Superficie non valida.");
        return;
      }
      await followupApi.updateApartment(selectedApartment._id, {
        code: editCode.trim(),
        name: editName.trim() || editCode.trim(),
        status: editStatus,
        surfaceMq,
      });
      await refetch();
      setEditApartmentOpen(false);
      setSelectedApartment((prev) =>
        prev ? { ...prev, code: editCode.trim(), name: editName.trim() || editCode.trim(), status: editStatus, surfaceMq } : null
      );
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleApplyFilters = () => {
    setStatusFilter(statusDraft);
    setPage(1);
  };

  const handleResetDrawerFilters = () => {
    setStatusDraft("all");
    setStatusFilter("all");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / APARTMENTS_PER_PAGE));
  const pageStart = total === 0 ? 0 : (page - 1) * APARTMENTS_PER_PAGE + 1;
  const pageEnd = Math.min(total, page * APARTMENTS_PER_PAGE);

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">

        {/* ── Page header ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-normal text-muted-foreground">Appartamenti</h1>
            <p className="mt-1 text-sm font-semibold leading-snug text-card-foreground">
              Cerca e filtra per codice, nome o stato. Clicca su un appartamento per i dettagli.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Verifica dati
            </Button>

            {/* Other options dropdown */}
            <div className="relative" ref={otherOptionsRef}>
              <Button
                variant="outline"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => setOtherOptionsOpen((v) => !v)}
              >
                Altro
                <span className={cn("ml-1 inline-block text-xs transition-transform", otherOptionsOpen && "rotate-180")}>▾</span>
              </Button>
              {otherOptionsOpen && (
                <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-border bg-background shadow-dropdown">
                  {[
                    { icon: Upload, label: "Importa Excel" },
                    { icon: Download, label: "Esporta Excel" },
                    { icon: ArrowLeftRight, label: "Vai alla vecchia interfaccia" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab per modalità (Tutti / Vendita / Affitto) ───────── */}
        <Tabs
          value={modeFilter}
          onValueChange={(v: string) => {
            setModeFilter(v as ModeFilter);
            setPage(1);
          }}
          className="mt-6"
        >
          <TabsList className="h-auto w-auto border-b border-border bg-transparent p-0">
            {MODE_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="rounded-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ── Elenco appartamenti ────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">Elenco appartamenti</h2>

          <div className="overflow-hidden rounded-lg border border-border bg-background shadow-panel">

            {/* Barra ricerca e filtri */}
            <div className="border-b border-border px-4 py-4 lg:px-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-10 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground"
                    placeholder="Cerca per codice o nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 gap-1.5 rounded-lg border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={() => setFiltersDrawerOpen(true)}
                  >
                    <Filter className="h-4 w-4" />
                    Filtri
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={handleSearch}
                  >
                    Cerca
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Azzera
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
                    onClick={() => refetch()}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Aggiorna
                  </Button>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px]">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                    <th className="w-10 px-4 py-4 font-normal" />
                    <th className="px-4 py-4 font-normal">Appartamento</th>
                    <th className="px-4 py-4 font-normal">Aggiornato il</th>
                    <th className="px-4 py-4 font-normal">Tipologia</th>
                    <th className="px-4 py-4 font-normal">
                      <span className="block">Superficie</span>
                      <span className="text-[10px] leading-3 text-muted-foreground">mq</span>
                    </th>
                    <th className="px-4 py-4 font-normal">Piano</th>
                    <th className="px-4 py-4 font-normal">Prezzo</th>
                    <th className="px-4 py-4 font-normal">Disponibilità</th>
                    <th className="px-4 py-4 font-normal">Stato</th>
                    <th className="w-10 px-4 py-4 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && apartments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        Caricamento...
                      </td>
                    </tr>
                  ) : apartments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        {committedSearch ? "Nessun risultato per questa ricerca" : "Nessun appartamento trovato"}
                      </td>
                    </tr>
                  ) : (
                    apartments.map((apt) => {
                      const availability = availabilityInfo(apt.status);
                      const status = statusInfo(apt);
                      return (
                        <tr
                          key={apt._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/apartments/${apt._id}`)}
                          onKeyDown={(e) => e.key === "Enter" && navigate(`/apartments/${apt._id}`)}
                          className="group border-b border-border text-sm text-foreground hover:bg-muted cursor-pointer"
                        >
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center text-primary opacity-50 transition-opacity hover:opacity-100"
                              aria-label="Apri scheda appartamento"
                              onClick={() => navigate(`/apartments/${apt._id}`)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              className="text-left font-normal text-primary hover:underline"
                              onClick={(e) => { e.stopPropagation(); navigate(`/apartments/${apt._id}`); }}
                            >
                              {apt.code}
                            </button>
                            {apt.name && apt.name !== apt.code && (
                              <div className="text-xs text-muted-foreground">{apt.name}</div>
                            )}
                          </td>

                          {/* Updated on */}
                          <td className="px-4 py-4">{formatDate(apt.updatedAt)}</td>

                          {/* Dimension */}
                          <td className="px-4 py-4">{roomLabel(apt.surfaceMq)}</td>

                          {/* Surface */}
                          <td className="px-4 py-4">{apt.surfaceMq}</td>

                          {/* Floor */}
                          <td className="px-4 py-4">{pseudoFloor(apt.code)}</td>

                          {/* Price */}
                          <td className="px-4 py-4">{apt.normalizedPrice?.display ?? "—"}</td>

                          {/* Availability */}
                          <td className="px-4 py-4">
                            <span className={cn("text-sm", availability.className)}>
                              {availability.label}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: status.dot }}
                                aria-hidden="true"
                              />
                              {status.label}
                            </span>
                          </td>

                          {/* Row overflow menu */}
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="More options"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <span className="text-sm text-muted-foreground">
                {total === 0 ? "Nessun appartamento" : `${pageStart}–${pageEnd} di ${total} appartamenti`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="First page"
                >
                  <span className="text-xs font-bold">{`«`}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <span className="text-xs font-bold">{`‹`}</span>
                </Button>
                <div className="px-2 text-sm text-foreground">
                  <strong>{page}</strong> / <strong>{totalPages}</strong>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <span className="text-xs font-bold">{`›`}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Last page"
                >
                  <span className="text-xs font-bold">{`»`}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FiltersDrawer
        open={filtersDrawerOpen}
        onOpenChange={setFiltersDrawerOpen}
        title="Filtri"
        onApply={handleApplyFilters}
        onReset={handleResetDrawerFilters}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
            <Select value={statusDraft} onValueChange={setStatusDraft}>
              <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FiltersDrawer>

      {/* Scheda dettaglio appartamento (progressive disclosure) */}
      <Sheet
        open={selectedApartment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApartment(null);
            setShowDetailMore(false);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          {selectedApartment && (
            <>
              <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">
                {selectedApartment.code}
                {selectedApartment.name && selectedApartment.name !== selectedApartment.code && (
                  <span className="block text-sm font-normal text-muted-foreground mt-0.5">{selectedApartment.name}</span>
                )}
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Prezzo</span>
                  <p className="font-medium text-foreground">{selectedApartment.normalizedPrice?.display ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Superficie</span>
                  <p className="font-medium text-foreground">{selectedApartment.surfaceMq} mq</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Disponibilità</span>
                  <p className="font-medium text-foreground">{availabilityInfo(selectedApartment.status).label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stato</span>
                  <p className="font-medium text-foreground">{statusLabelMap[selectedApartment.status]}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex flex-col gap-3">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full rounded-lg gap-2"
                  onClick={() => navigate(`/apartments/${selectedApartment._id}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Apri scheda
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={() => setEditApartmentOpen(true)}
                >
                  Modifica
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDetailMore((v) => !v)}
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded text-left"
                >
                  {showDetailMore ? "Mostra meno" : "Mostra altro"}
                </button>
                {showDetailMore && (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Aggiornato il:</span> {formatDate(selectedApartment.updatedAt)}</p>
                    <p><span className="font-medium text-foreground">Tipologia:</span> {roomLabel(selectedApartment.surfaceMq)}</p>
                    <p><span className="font-medium text-foreground">Piano:</span> {pseudoFloor(selectedApartment.code)}</p>
                    <p><span className="font-medium text-foreground">Modalità:</span> {selectedApartment.mode === "RENT" ? "Affitto" : "Vendita"}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Drawer Modifica appartamento */}
      <Drawer open={editApartmentOpen} onOpenChange={setEditApartmentOpen}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Modifica appartamento</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleEditApartmentSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Codice</label>
                <Input
                  className="h-10 rounded-lg border-border"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Nome</label>
                <Input
                  className="h-10 rounded-lg border-border"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome appartamento"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ApartmentRow["status"])}>
                  <SelectTrigger className="h-10 rounded-lg border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Superficie (mq)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="h-10 rounded-lg border-border"
                  value={editSurfaceMq}
                  onChange={(e) => setEditSurfaceMq(e.target.value)}
                  required
                />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </DrawerBody>
            <DrawerFooter>
              <Button type="button" variant="outline" onClick={() => setEditApartmentOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
