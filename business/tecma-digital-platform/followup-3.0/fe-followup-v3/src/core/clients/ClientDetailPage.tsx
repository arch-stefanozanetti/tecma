import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Home, Calendar, FileText, User, ClipboardList, Pencil, History, UserPlus, Trash2, Mail, Phone, CalendarCheck } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type { AdditionalInfoRow, ClientRow, RequestRow, RequestStatus } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";
import { STATUS_FILTER_OPTIONS } from "./constants";

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  Lead: "Lead",
  prospect: "Prospect",
  Prospect: "Prospect",
  client: "Client",
  Client: "Client",
  contacted: "Contacted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Nuova",
  contacted: "Contattato",
  viewing: "Visita",
  quote: "Preventivo",
  offer: "Offerta",
  won: "Vinto",
  lost: "Perso",
};

const statusLabel = (raw: string) => STATUS_LABEL[raw] ?? raw;

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

/** Campi usati per la profilazione (match): più sono compilati, migliore il match. */
const PROFILATION_FIELDS: (keyof ClientRow)[] = [
  "email",
  "phone",
  "city",
  "source",
  "myhomeVersion",
  "createdBy",
];

function getProfilationPercent(client: ClientRow): number {
  let filled = 0;
  for (const key of PROFILATION_FIELDS) {
    const v = client[key];
    if (v != null && String(v).trim() !== "") filled++;
  }
  const total = PROFILATION_FIELDS.length;
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

export const ClientDetailPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, isAdmin } = useWorkspace();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState("lead");
  const [formCity, setFormCity] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [additionalInfos, setAdditionalInfos] = useState<AdditionalInfoRow[]>([]);
  const [formAdditionalInfo, setFormAdditionalInfo] = useState<Record<string, unknown>>({});
  const [auditEvents, setAuditEvents] = useState<Array<{ _id: string; at: string; action: string; actor?: { email?: string }; payload?: Record<string, unknown> }>>([]);
  const [assignments, setAssignments] = useState<Array<{ userId: string }>>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ userId: string }>>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [actionLogging, setActionLogging] = useState<string | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<Array<{ item: { _id: string; code: string; name?: string; status: string; mode: string; surfaceMq: number }; score: number; reasons: string[] }>>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !client || !workspaceId || selectedProjectIds.length === 0) return;
    setMatchLoading(true);
    followupApi
      .getClientCandidates(clientId, workspaceId, [client.projectId])
      .then((r) => setMatchCandidates((r.data ?? []) as unknown as typeof matchCandidates))
      .catch(() => setMatchCandidates([]))
      .finally(() => setMatchLoading(false));
  }, [clientId, client?.projectId, workspaceId, selectedProjectIds.length]);

  const logAction = async (type: "mail_received" | "mail_sent" | "call_completed" | "meeting_scheduled") => {
    if (!clientId) return;
    setActionLogging(type);
    try {
      await followupApi.createClientAction(clientId, type);
      await followupApi.getAuditForEntity("client", clientId, workspaceId ?? "", 25).then((r) => setAuditEvents(r.data ?? []));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Errore durante la registrazione dell'azione.");
    } finally {
      setActionLogging(null);
    }
  };

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    followupApi
      .getClientById(clientId)
      .then((r) => {
        setClient(r.client);
      })
      .catch((err) => {
        const msg = err?.message ?? "Errore nel caricamento";
        const is404 =
          /not found/i.test(String(msg)) ||
          (typeof (err as { statusCode?: number })?.statusCode === "number" &&
            (err as { statusCode: number }).statusCode === 404);
        setError(is404 ? "Cliente non trovato" : msg);
        setClient(null);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !client || !workspaceId || selectedProjectIds.length === 0) return;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds: [client.projectId],
        page: 1,
        perPage: 50,
        filters: { clientId },
      })
      .then((r) => {
        setRequests(r.data ?? []);
      })
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [clientId, client?.projectId, workspaceId, selectedProjectIds.length]);

  const profilationPercent = useMemo(
    () => (client ? getProfilationPercent(client) : 0),
    [client]
  );

  const timelineSorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [requests]
  );

  useEffect(() => {
    if (!workspaceId) return;
    followupApi
      .listAdditionalInfos(workspaceId)
      .then((r) => setAdditionalInfos(r.data ?? []))
      .catch(() => setAdditionalInfos([]));
  }, [workspaceId]);

  useEffect(() => {
    if (!clientId || !workspaceId) return;
    followupApi
      .getAuditForEntity("client", clientId, workspaceId, 25)
      .then((r) => setAuditEvents(r.data ?? []))
      .catch(() => setAuditEvents([]));
  }, [clientId, workspaceId]);

  useEffect(() => {
    if (!clientId || !workspaceId) return;
    followupApi
      .listEntityAssignments(workspaceId, "client", clientId)
      .then((r) => setAssignments(r.data ?? []))
      .catch(() => setAssignments([]));
  }, [clientId, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isAdmin) return;
    followupApi
      .listWorkspaceUsers(workspaceId)
      .then((r) => setWorkspaceUsers(r.data ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [workspaceId, isAdmin]);

  useEffect(() => {
    if (!editDialogOpen || !client) return;
    setFormFullName(client.fullName ?? "");
    setFormEmail(client.email ?? "");
    setFormPhone(client.phone ?? "");
    setFormStatus(client.status ?? "lead");
    setFormCity(client.city ?? "");
    const customInfos = additionalInfos.filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo");
    setFormAdditionalInfo(
      customInfos.length > 0
        ? Object.fromEntries(customInfos.map((ai) => [ai.name, client.additionalInfo?.[ai.name] ?? ""]))
        : client.additionalInfo && typeof client.additionalInfo === "object"
          ? { ...client.additionalInfo }
          : {}
    );
    setFormSubmitError(null);
  }, [editDialogOpen, client, additionalInfos]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setFormSubmitError(null);
    setFormSaving(true);
    try {
      const additionalInfoPayload =
        Object.keys(formAdditionalInfo).length > 0
          ? Object.fromEntries(
              Object.entries(formAdditionalInfo).filter(([, v]) => v != null && String(v).trim() !== "")
            )
          : undefined;
      const res = await followupApi.updateClient(client._id, {
        fullName: formFullName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        city: formCity.trim() || undefined,
        additionalInfo: additionalInfoPayload,
      });
      setClient(res.client);
      setEditDialogOpen(false);
    } catch (err) {
      setFormSubmitError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setFormSaving(false);
    }
  };

  const goBack = () => navigate("/?section=clients");

  const handleAssign = async () => {
    if (!clientId || !workspaceId || !assignUserId.trim()) return;
    try {
      await followupApi.assignEntity(workspaceId, "client", clientId, assignUserId.trim());
      setAssignments((prev) => [...prev, { userId: assignUserId.trim() }]);
      setAssignUserId("");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Errore assegnazione");
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!clientId || !workspaceId) return;
    if (!window.confirm(`Rimuovere assegnazione a ${userId}?`)) return;
    try {
      await followupApi.unassignEntity(workspaceId, "client", clientId, userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Errore rimozione");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
          <Pencil className="h-4 w-4" />
          Modifica
        </Button>
      </div>

      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{client.fullName}</h1>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              "bg-muted text-muted-foreground"
            )}
          >
            {statusLabel(client.status)}
          </span>
        </div>
      </header>

      <Drawer open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Modifica cliente</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Nome *</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
                placeholder="Nome e cognome"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                className="h-10 rounded-lg border-border"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@esempio.it"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Telefono</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+39 ..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Città</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Città"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
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
            {additionalInfos
              .filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo" && ai.active !== false)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((ai) => (
                <div key={ai._id}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {ai.label}
                    {ai.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  {ai.type === "radio" && ai.options && ai.options.length > 0 ? (
                    <Select
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onValueChange={(v) => setFormAdditionalInfo((prev) => ({ ...prev, [ai.name]: v }))}
                    >
                      <SelectTrigger className="h-10 rounded-lg border-border">
                        <SelectValue placeholder={`Seleziona ${ai.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {ai.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-10 rounded-lg border-border"
                      type={ai.type === "number" ? "number" : "text"}
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onChange={(e) =>
                        setFormAdditionalInfo((prev) => ({
                          ...prev,
                          [ai.name]: ai.type === "number" ? (e.target.value ? Number(e.target.value) : "") : e.target.value,
                        }))
                      }
                      placeholder={ai.label}
                    />
                  )}
                </div>
              ))}
            {formSubmitError && (
              <p className="text-sm text-destructive">{formSubmitError}</p>
            )}
            </DrawerBody>
            <DrawerFooter>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={formSaving}>
                  {formSaving ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <Tabs defaultValue="profilo" className="space-y-6">
        <TabsList className="w-full flex flex-wrap border-b border-border bg-transparent p-0">
          <TabsTrigger value="profilo" icon={<User className="h-4 w-4" />}>
            Profilo
          </TabsTrigger>
          <TabsTrigger value="trattative" icon={<Calendar className="h-4 w-4" />}>
            Trattative
          </TabsTrigger>
          <TabsTrigger value="appartamenti" icon={<Home className="h-4 w-4" />}>
            Appartamenti
          </TabsTrigger>
          <TabsTrigger value="timeline" icon={<History className="h-4 w-4" />}>
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Tab Profilo — allineato a scheda cliente e match: Contatti, Profilazione, Dettaglio/Info, Date e ID */}
        <TabsContent value="profilo" className="space-y-6 mt-4">
          <div className="grid gap-6 sm:grid-cols-2">
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Azioni rapide</h2>
            <p className="text-xs text-muted-foreground">
              Registra le attività svolte con il cliente. Le azioni compaiono nella timeline.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("mail_received")}
                disabled={actionLogging !== null}
              >
                <Mail className="h-3.5 w-3.5" />
                {actionLogging === "mail_received" ? "..." : "Mail ricevuta"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("mail_sent")}
                disabled={actionLogging !== null}
              >
                <Mail className="h-3.5 w-3.5" />
                {actionLogging === "mail_sent" ? "..." : "Mail inviata"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("call_completed")}
                disabled={actionLogging !== null}
              >
                <Phone className="h-3.5 w-3.5" />
                {actionLogging === "call_completed" ? "..." : "Chiamata fatta"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("meeting_scheduled")}
                disabled={actionLogging !== null}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                {actionLogging === "meeting_scheduled" ? "..." : "Meeting fissato"}
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Contatti</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="font-medium text-foreground">{client.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telefono</span>
                <p className="font-medium text-foreground">{client.phone ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Città</span>
                <p className="font-medium text-foreground">{client.city ?? "—"}</p>
              </div>
              {client.coniuge && (client.coniuge.nome || client.coniuge.cognome || client.coniuge.mail) && (
                <div>
                  <span className="text-muted-foreground">Coniuge</span>
                  <p className="font-medium text-foreground">
                    {[client.coniuge.nome, client.coniuge.cognome].filter(Boolean).join(" ") || "—"}
                    {client.coniuge.mail && ` • ${client.coniuge.mail}`}
                  </p>
                </div>
              )}
            </div>
          </section>

            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Profilazione per il match</h2>
              <p className="text-xs text-muted-foreground">
                Più il profilo è completo, più i consigli di appartamenti saranno pertinenti.
              </p>
              <Progress value={profilationPercent} showLabel />
              {profilationPercent < 100 && (
                <p className="text-xs text-muted-foreground">
                  Completa email, telefono, città, fonte e altri campi per migliorare il match.
                </p>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Info e dettaglio</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {client.profilazione && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Profilazione</span>
              )}
              {client.trattamento && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Trattamento</span>
              )}
              {client.marketing && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Marketing</span>
              )}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Progetto</span>
                <p className="font-mono text-xs text-foreground">{client.projectId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stato</span>
                <p className="font-medium text-foreground">{statusLabel(client.status)}</p>
              </div>
              {client.source != null && (
                <div>
                  <span className="text-muted-foreground">Fonte</span>
                  <p className="font-medium text-foreground">{client.source}</p>
                </div>
              )}
              {client.budget != null && client.budget !== "" && (
                <div>
                  <span className="text-muted-foreground">Budget</span>
                  <p className="font-medium text-foreground">{String(client.budget)}</p>
                </div>
              )}
              {client.motivazione != null && (
                <div>
                  <span className="text-muted-foreground">Motivazione</span>
                  <p className="font-medium text-foreground">{client.motivazione}</p>
                </div>
              )}
              {client.nProposals != null && (
                <div>
                  <span className="text-muted-foreground">Proposte</span>
                  <p className="font-medium text-foreground">{client.nProposals}</p>
                </div>
              )}
              {client.nReserved != null && (
                <div>
                  <span className="text-muted-foreground">Riservati</span>
                  <p className="font-medium text-foreground">{client.nReserved}</p>
                </div>
              )}
              {client.myhomeVersion != null && (
                <div>
                  <span className="text-muted-foreground">Versione MyHome</span>
                  <p className="font-medium text-foreground">{client.myhomeVersion}</p>
                </div>
              )}
              {client.createdBy != null && (
                <div>
                  <span className="text-muted-foreground">Creato da</span>
                  <p className="font-medium text-foreground">{client.createdBy}</p>
                </div>
              )}
            </div>
            {client.note && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Note</span>
                <p className="font-medium text-foreground mt-1">{client.note}</p>
              </div>
            )}
            {client.family && (client.family.adulti != null || client.family.bambini != null || client.family.animali != null) && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Famiglia</span>
                <p className="font-medium text-foreground mt-1">
                  Adulti: {client.family.adulti ?? "—"} • Bambini: {client.family.bambini ?? "—"} • Animali: {client.family.animali ?? "—"}
                </p>
              </div>
            )}
            {(() => {
              const customInfos = additionalInfos.filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo");
              const hasCustom = customInfos.length > 0 || (client.additionalInfo && typeof client.additionalInfo === "object" && Object.keys(client.additionalInfo).length > 0);
              if (!hasCustom) return null;
              return (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-muted-foreground">Info aggiuntive</span>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {customInfos.length > 0
                      ? customInfos.map((ai) => {
                          const val = client.additionalInfo?.[ai.name];
                          if (val == null || (typeof val === "string" && val.trim() === "")) return null;
                          return (
                            <div key={ai._id}>
                              <span className="text-muted-foreground">{ai.label}</span>
                              <p className="font-medium text-foreground">
                                {Array.isArray(val) ? val.join(", ") : String(val)}
                              </p>
                            </div>
                          );
                        })
                      : Object.entries(client.additionalInfo ?? {}).map(([key, val]) =>
                          val != null && (typeof val !== "string" || val.trim() !== "") ? (
                            <div key={key}>
                              <span className="text-muted-foreground">{key}</span>
                              <p className="font-medium text-foreground">
                                {Array.isArray(val) ? val.join(", ") : String(val)}
                              </p>
                            </div>
                          ) : null
                        )}
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Date e dettagli tecnici
            </h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Creato il</span>
                <p className="font-medium text-foreground">{formatDate(client.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Aggiornato il</span>
                <p className="font-medium text-foreground">{formatDate(client.updatedAt)}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">ID</span>
                <p className="font-mono text-xs text-foreground">{client._id}</p>
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
                Assegna questo cliente a un vendor per limitarne la visibilità.
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

        {/* Tab Trattative — timeline trattative */}
        <TabsContent value="trattative" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline trattative
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : timelineSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna trattativa associata. Crea una trattativa dalla sezione Trattative per
                vedere qui gli aggiornamenti.
              </p>
            ) : (
              <ul className="space-y-0">
                {timelineSorted.map((req) => (
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
                        <span className="font-medium text-foreground">
                          {REQUEST_STATUS_LABEL[req.status]}
                        </span>
                        <span className="text-muted-foreground">
                          {req.type === "sell" ? "Vendita" : "Affitto"}
                        </span>
                        {req.apartmentId && (
                          <Link
                            to={`/apartments/${req.apartmentId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {req.apartmentCode ?? req.apartmentId}
                          </Link>
                        )}
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

        {/* Tab Appartamenti — consigliati (placeholder) + appartamenti dalle trattative */}
        <TabsContent value="appartamenti" className="space-y-6 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Home className="h-4 w-4" />
              Appartamenti in trattativa
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : (
              (() => {
                const withApt = requests.filter((r) => r.apartmentId);
                const seen = new Set<string>();
                const unique = withApt.filter((r) => {
                  if (r.apartmentId && !seen.has(r.apartmentId)) {
                    seen.add(r.apartmentId);
                    return true;
                  }
                  return false;
                });
                if (unique.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Nessun appartamento associato alle trattative. Le trattative con
                      appartamento appariranno qui.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-2">
                    {unique.map((req) => (
                      <li key={req.apartmentId}>
                        <Link
                          to={`/apartments/${req.apartmentId}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {req.apartmentCode ?? req.apartmentId}
                        </Link>
                        <span className="text-muted-foreground text-sm ml-2">
                          — {REQUEST_STATUS_LABEL[req.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Appartamenti papabili (matching)
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Appartamenti disponibili compatibili con il profilo del cliente. Score 0-100.
            </p>
            {matchLoading ? (
              <p className="text-sm text-muted-foreground">Calcolo in corso...</p>
            ) : matchCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun appartamento papabile trovato. Completa il profilo (budget, città) per migliorare il matching.
              </p>
            ) : (
              <ul className="space-y-2">
                {matchCandidates.map(({ item, score, reasons }) => (
                  <li key={item._id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {score}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/apartments/${item._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.code}{item.name ? ` — ${item.name}` : ""}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.mode === "SELL" ? "Vendita" : "Affitto"} · {item.surfaceMq} m²
                      </p>
                      {reasons.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{reasons.join(" · ")}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* Tab Timeline — audit log per cliente */}
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
    </div>
  );
};
