import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { useIsMobile } from "../shared/useIsMobile";
import { usePaginatedList } from "../shared/usePaginatedList";
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
import { ImportExcelDrawer } from "./ImportExcelDrawer";
import { ApartmentsListSection } from "./ApartmentsListSection";
import {
  availabilityInfo,
  formatDate,
  pseudoFloor,
  roomLabel,
  STATUS_FILTER_OPTIONS,
  statusLabelMap,
  type ModeFilter,
} from "./ApartmentsPage.utils";

const APARTMENTS_PER_PAGE = 10;

export const ApartmentsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { workspaceId, selectedProjectIds, hasPermission } = useWorkspace();
  const canReadApartments = hasPermission("apartments.read");
  const canCreateApartments = hasPermission("apartments.create");
  const canUpdateApartments = hasPermission("apartments.update");
  const canExportApartments = hasPermission("apartments.export");
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
  const [importExcelOpen, setImportExcelOpen] = useState(false);
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
    loader: followupApi.apartments.queryApartments,
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
      await followupApi.apartments.updateApartment(selectedApartment._id, {
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
        <ApartmentsListSection
          search={search}
          onSearchChange={setSearch}
          onSubmitSearch={handleSearch}
          onResetFilters={handleResetFilters}
          onOpenFilters={() => setFiltersDrawerOpen(true)}
          onRefresh={() => refetch()}
          error={error}
          isLoading={isLoading}
          apartments={apartments}
          committedSearch={committedSearch}
          createApartmentDisabled={!canCreateApartments}
          createApartmentTitle={!canCreateApartments ? "Non hai il permesso di creare appartamenti" : undefined}
          importExcelDisabled={!canUpdateApartments}
          importExcelTitle={!canUpdateApartments ? "Non hai il permesso di importare (richiede modifica appartamenti)" : undefined}
          exportExcelDisabled={!canExportApartments}
          exportExcelTitle={!canExportApartments ? "Non hai il permesso di esportare" : undefined}
          onOpenApartment={(id) => {
            if (id === "create") {
              navigate("/?section=createApartment");
              return;
            }
            navigate(`/apartments/${id}`);
          }}
          total={total}
          page={page}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onFirstPage={() => setPage(1)}
          onPrevPage={() => setPage((v) => Math.max(1, v - 1))}
          onNextPage={() => setPage((v) => Math.min(totalPages, v + 1))}
          onLastPage={() => setPage(totalPages)}
          modeFilter={modeFilter}
          onModeChange={(v) => {
            setModeFilter(v);
            setPage(1);
          }}
          otherOptionsOpen={otherOptionsOpen}
          onToggleOtherOptions={() => setOtherOptionsOpen((v) => !v)}
          onOpenImportExcel={() => {
            setOtherOptionsOpen(false);
            setImportExcelOpen(true);
          }}
          otherOptionsRef={otherOptionsRef}
        />
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
              <SelectTrigger className="min-h-11 w-full rounded-lg border-border text-sm">
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
                  className="w-full min-h-11 rounded-lg gap-2"
                  onClick={() => navigate(`/apartments/${selectedApartment._id}`)}
                  disabled={!canReadApartments}
                  title={!canReadApartments ? "Non hai il permesso di aprire la scheda" : undefined}
                >
                  <ExternalLink className="h-4 w-4" />
                  Apri scheda
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full min-h-11 rounded-lg"
                  onClick={() => setEditApartmentOpen(true)}
                  disabled={!canUpdateApartments}
                  title={!canUpdateApartments ? "Non hai il permesso di modificare" : undefined}
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
        <DrawerContent side="right" size={isMobile ? "full" : "md"}>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Modifica appartamento</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleEditApartmentSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Codice</label>
                <Input
                  className="min-h-11 rounded-lg border-border"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Nome</label>
                <Input
                  className="min-h-11 rounded-lg border-border"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome appartamento"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ApartmentRow["status"])}>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
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
                  className="min-h-11 rounded-lg border-border"
                  value={editSurfaceMq}
                  onChange={(e) => setEditSurfaceMq(e.target.value)}
                  required
                />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </DrawerBody>
            <DrawerFooter>
              <Button type="button" variant="outline" onClick={() => setEditApartmentOpen(false)} className="min-h-11">
                Annulla
              </Button>
              <Button type="submit" disabled={editSaving || !canUpdateApartments} className="min-h-11">
                {editSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <ImportExcelDrawer
        open={importExcelOpen}
        onOpenChange={setImportExcelOpen}
        workspaceId={workspaceId ?? ""}
        projectId={selectedProjectIds[0] ?? ""}
        onImported={() => refetch()}
      />
    </div>
  );
};
