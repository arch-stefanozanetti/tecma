import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Home, Calendar, FileText, Users, Pencil, History, UserPlus, Trash2, Settings2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type { ApartmentRow, RequestRow, RequestStatus } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { cn } from "../../lib/utils";
import { MatchingCandidatesList } from "../../components/MatchingCandidatesList";
import { useWorkflowConfig } from "../../hooks/useWorkflowConfig";

const STATUS_FILTER_OPTIONS: { value: ApartmentRow["status"]; label: string }[] = [
  { value: "AVAILABLE", label: "Disponibile" },
  { value: "RESERVED", label: "Riservato" },
  { value: "SOLD", label: "Venduto" },
  { value: "RENTED", label: "Affittato" },
];

const STATUS_LABEL: Record<ApartmentRow["status"], string> = {
  AVAILABLE: "Disponibile",
  RESERVED: "Riservato",
  SOLD: "Venduto",
  RENTED: "Affittato",
};

const MODE_LABEL: Record<ApartmentRow["mode"], string> = {
  RENT: "Affitto",
  SELL: "Vendita",
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

export const ApartmentDetailPage = () => {
  const { apartmentId } = useParams<{ apartmentId: string }>();
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, isAdmin } = useWorkspace();
  const workflowConfigRent = useWorkflowConfig(workspaceId, "rent");
  const workflowConfigSell = useWorkflowConfig(workspaceId, "sell");
  const getWorkflowConfig = (type: "rent" | "sell") => (type === "rent" ? workflowConfigRent : workflowConfigSell);
  const [apartment, setApartment] = useState<ApartmentRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<Array<{ _id: string; at: string; action: string; actor?: { email?: string } }>>([]);
  const [assignments, setAssignments] = useState<Array<{ userId: string }>>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ userId: string }>>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [matchCandidates, setMatchCandidates] = useState<Array<{ item: { _id: string; fullName: string; email?: string; status: string }; score: number; reasons: string[] }>>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [editApartmentOpen, setEditApartmentOpen] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<ApartmentRow["status"]>("AVAILABLE");
  const [editSurfaceMq, setEditSurfaceMq] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;
    setLoading(true);
    setError(null);
    followupApi
      .getApartmentById(apartmentId)
      .then((r) => {
        setApartment(r.apartment);
      })
      .catch((err) => {
        const msg = err?.message ?? "Errore nel caricamento";
        const is404 =
          /not found/i.test(String(msg)) ||
          (typeof (err as { statusCode?: number })?.statusCode === "number" &&
            (err as { statusCode: number }).statusCode === 404);
        setError(is404 ? "Appartamento non trovato" : msg);
        setApartment(null);
      })
      .finally(() => setLoading(false));
  }, [apartmentId]);

  useEffect(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds: [apartment.projectId],
        page: 1,
        perPage: 50,
        filters: { apartmentId },
      })
      .then((r) => {
        setRequests(r.data ?? []);
      })
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [apartmentId, apartment?.projectId, workspaceId, selectedProjectIds.length]);

  const requestsSorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [requests]
  );

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi
      .getAuditForEntity("apartment", apartmentId, workspaceId, 25)
      .then((r) => setAuditEvents(r.data ?? []))
      .catch(() => setAuditEvents([]));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!apartmentId || !workspaceId) return;
    followupApi
      .listEntityAssignments(workspaceId, "apartment", apartmentId)
      .then((r) => setAssignments(r.data ?? []))
      .catch(() => setAssignments([]));
  }, [apartmentId, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isAdmin) return;
    followupApi
      .listWorkspaceUsers(workspaceId)
      .then((r) => setWorkspaceUsers(r.data ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [workspaceId, isAdmin]);

  useEffect(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    setMatchLoading(true);
    followupApi
      .getApartmentCandidates(apartmentId, workspaceId, [apartment.projectId])
      .then((r) => setMatchCandidates((r.data ?? []) as unknown as typeof matchCandidates))
      .catch(() => setMatchCandidates([]))
      .finally(() => setMatchLoading(false));
  }, [apartmentId, apartment?.projectId, workspaceId, selectedProjectIds.length]);

  const handleAssign = async () => {
    if (!apartmentId || !workspaceId || !assignUserId.trim()) return;
    try {
      await followupApi.assignEntity(workspaceId, "apartment", apartmentId, assignUserId.trim());
      setAssignments((prev) => [...prev, { userId: assignUserId.trim() }]);
      setAssignUserId("");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Errore assegnazione");
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!apartmentId || !workspaceId) return;
    if (!window.confirm(`Rimuovere assegnazione a ${userId}?`)) return;
    try {
      await followupApi.unassignEntity(workspaceId, "apartment", apartmentId, userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Errore rimozione");
    }
  };

  const goBack = () => navigate("/?section=apartments");

  const goToEditApartmentHC = () => {
    navigate("/?section=editApartmentHC", { state: { editApartmentId: apartmentId } });
  };

  useEffect(() => {
    if (editApartmentOpen && apartment) {
      setEditCode(apartment.code);
      setEditName(apartment.name ?? "");
      setEditStatus(apartment.status);
      setEditSurfaceMq(String(apartment.surfaceMq ?? ""));
      setEditError(null);
    }
  }, [editApartmentOpen, apartment]);

  const handleEditApartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartment) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const surfaceMq = Number(editSurfaceMq);
      if (Number.isNaN(surfaceMq) || surfaceMq < 0) {
        setEditError("Superficie non valida.");
        return;
      }
      const updated = await followupApi.updateApartment(apartment._id, {
        code: editCode.trim(),
        name: editName.trim() || editCode.trim(),
        status: editStatus,
        surfaceMq,
      });
      setApartment(updated.apartment);
      setEditApartmentOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (error && !apartment) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!apartment) return null;

  const priceDisplay =
    apartment.normalizedPrice &&
    typeof apartment.normalizedPrice === "object" &&
    "display" in apartment.normalizedPrice
      ? (apartment.normalizedPrice as { display: string }).display
      : apartment.rawPrice != null && typeof apartment.rawPrice === "object" && "amount" in apartment.rawPrice
        ? new Intl.NumberFormat("it-IT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format((apartment.rawPrice as { amount: number }).amount)
        : "—";

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditApartmentOpen(true)}>
            <Pencil className="h-4 w-4" />
            Modifica
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={goToEditApartmentHC}>
            <Settings2 className="h-4 w-4" />
            Configura HC
          </Button>
        </div>
      </div>

      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {apartment.name || apartment.code}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                "bg-muted text-muted-foreground"
              )}
            >
              {STATUS_LABEL[apartment.status]}
            </span>
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                "bg-muted text-muted-foreground"
              )}
            >
              {MODE_LABEL[apartment.mode]}
            </span>
          </div>
          {apartment.name && apartment.code !== apartment.name && (
            <p className="mt-1 text-sm text-muted-foreground">Codice: {apartment.code}</p>
          )}
        </div>
      </header>

      <Tabs defaultValue="panoramica" className="space-y-6">
        <TabsList className="w-full flex flex-wrap border-b border-border bg-transparent p-0">
          <TabsTrigger value="panoramica" icon={<Home className="h-4 w-4" />}>
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="trattative" icon={<Users className="h-4 w-4" />}>
            Trattative
          </TabsTrigger>
          <TabsTrigger value="matching" icon={<Users className="h-4 w-4" />}>
            Clienti papabili
          </TabsTrigger>
          <TabsTrigger value="dettagli" icon={<FileText className="h-4 w-4" />}>
            Dettagli
          </TabsTrigger>
          <TabsTrigger value="timeline" icon={<History className="h-4 w-4" />}>
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Tab Panoramica */}
        <TabsContent value="panoramica" className="space-y-6 mt-4">
          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Dettaglio</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Codice</span>
                  <p className="font-mono font-medium text-foreground">{apartment.code}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium text-foreground">{apartment.name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Superficie</span>
                  <p className="font-medium text-foreground">
                    {apartment.surfaceMq != null ? `${apartment.surfaceMq} m²` : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prezzo</span>
                  <p className="font-medium text-foreground">{priceDisplay}</p>
                </div>
                {apartment.floor != null && (
                  <div>
                    <span className="text-muted-foreground">Piano</span>
                    <p className="font-medium text-foreground">{apartment.floor}</p>
                  </div>
                )}
                {apartment.building?.name && (
                  <div>
                    <span className="text-muted-foreground">Edificio</span>
                    <p className="font-medium text-foreground">{apartment.building.name}</p>
                  </div>
                )}
                {apartment.building?.address && (
                  <div>
                    <span className="text-muted-foreground">Indirizzo</span>
                    <p className="font-medium text-foreground">{apartment.building.address}</p>
                  </div>
                )}
                {apartment.plan?.typology?.name && (
                  <div>
                    <span className="text-muted-foreground">Tipologia</span>
                    <p className="font-medium text-foreground">{apartment.plan.typology.name}</p>
                  </div>
                )}
                {apartment.plan?.mainFeatures && (
                  <div>
                    <span className="text-muted-foreground">Caratteristiche</span>
                    <p className="font-medium text-foreground">
                      {[
                        apartment.plan.mainFeatures.rooms != null && `${apartment.plan.mainFeatures.rooms} vani`,
                        apartment.plan.mainFeatures.bedroom != null && `${apartment.plan.mainFeatures.bedroom} camere`,
                        apartment.plan.mainFeatures.bathroom != null && `${apartment.plan.mainFeatures.bathroom} bagni`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                )}
                {apartment.sides && apartment.sides.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Lati</span>
                    <p className="font-medium text-foreground">
                      {apartment.sides.map((s) => s.name).filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Progetto</span>
                  <p className="font-mono text-xs text-foreground">{apartment.projectId}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Stato e modalità</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Stato</span>
                  <p className="font-medium text-foreground">{STATUS_LABEL[apartment.status]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Modalità</span>
                  <p className="font-medium text-foreground">{MODE_LABEL[apartment.mode]}</p>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Tab Trattative — clienti e trattative su questo appartamento */}
        <TabsContent value="trattative" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Clienti e trattative
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : requestsSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna trattativa associata a questo appartamento. Le trattative con questo
                immobile appariranno qui.
              </p>
            ) : (
              <ul className="space-y-0">
                {requestsSorted.map((req) => (
                  <li key={req._id} className="flex gap-3 py-3">
                    <div
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        req.status === "won"
                          ? "bg-green-500"
                          : req.status === "lost"
                            ? "bg-muted-foreground/50"
                            : "bg-primary"
                      )}
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {req.clientId ? (
                          <Link
                            to={`/clients/${req.clientId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {req.clientName ?? req.clientId}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">
                            {req.clientName ?? req.clientId ?? "—"}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {getWorkflowConfig(req.type).statusLabelByCode[req.status] ?? req.status}
                        </span>
                        <span className="text-muted-foreground">
                          — {req.type === "sell" ? "Vendita" : "Affitto"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(req.updatedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* Tab Clienti papabili — matching */}
        <TabsContent value="matching" className="space-y-4 mt-4">
          <MatchingCandidatesList
            title="Clienti papabili (matching)"
            introText="Clienti il cui profilo (budget, zona) è più compatibile con questo appartamento."
            emptyMessage="Nessun cliente papabile trovato. Completa i profili clienti (budget, città) per migliorare il matching."
            loading={matchLoading}
            candidates={matchCandidates}
            getItemLink={(item) => `/clients/${item._id}`}
            renderItemTitle={(item) => item.fullName}
            renderItemSubtitle={(item) => item.email ?? null}
          />
        </TabsContent>

        {/* Tab Dettagli — extraInfo, date e ID */}
        <TabsContent value="dettagli" className="space-y-4 mt-4">
          {apartment.extraInfo && Object.keys(apartment.extraInfo).length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Info aggiuntive</h2>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(apartment.extraInfo).map(([key, value]) =>
                  value != null && value !== "" ? (
                    <div key={key}>
                      <span className="text-muted-foreground">{key}</span>
                      <p className="font-medium text-foreground">{String(value)}</p>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Date e dettagli tecnici</h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Aggiornato il</span>
                <p className="font-medium text-foreground">{formatDate(apartment.updatedAt)}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">ID</span>
                <p className="font-mono text-xs text-foreground">{apartment._id}</p>
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assegnato a
              </h2>
              <p className="text-xs text-muted-foreground mb-2">
                Assegna questo appartamento a un vendor per limitarne la visibilità.
              </p>
              <ul className="space-y-1 mb-3">
                {assignments.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span>{a.userId}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-destructive" onClick={() => handleUnassign(a.userId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
                {assignments.length === 0 && <li className="text-sm text-muted-foreground">Nessuna assegnazione</li>}
              </ul>
              <div className="flex gap-2">
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger className="flex-1 max-w-xs">
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceUsers
                      .filter((u) => !assignments.some((a) => a.userId === u.userId))
                      .map((u) => (
                        <SelectItem key={u.userId} value={u.userId}>{u.userId}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssign} disabled={!assignUserId.trim()}>
                  Assegna
                </Button>
              </div>
            </section>
          )}
        </TabsContent>

        {/* Tab Timeline — audit log per appartamento */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              Ultime attività
            </h2>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
            ) : (
              <ul className="space-y-2">
                {auditEvents.map((ev) => (
                  <li key={ev._id} className="flex gap-3 py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted-foreground shrink-0">{formatDate(ev.at)}</span>
                    <span className="font-medium text-foreground">
                      {ev.action.replace(/\./g, " ")}
                      {ev.actor?.email && (
                        <span className="text-muted-foreground font-normal ml-1">— {ev.actor.email}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

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
                    {STATUS_FILTER_OPTIONS.map((opt) => (
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
