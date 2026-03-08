import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Home, Calendar, FileText, User, ClipboardList } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type { ClientRow, RequestRow, RequestStatus } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";

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
  const { workspaceId, selectedProjectIds } = useWorkspace();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const goBack = () => navigate("/?section=clients");

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
        </TabsList>

        {/* Tab Profilo — allineato a scheda cliente e match: Contatti, Profilazione, Dettaglio/Info, Date e ID */}
        <TabsContent value="profilo" className="space-y-6 mt-4">
          <div className="grid gap-6 sm:grid-cols-2">
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
            {client.additionalInfo && typeof client.additionalInfo === "object" && Object.keys(client.additionalInfo).length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Info aggiuntive</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Array.isArray(client.additionalInfo.tag) &&
                    client.additionalInfo.tag.map((t: string, i: number) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  {client.additionalInfo.iniziativa != null && (
                    <span className="text-sm">Iniziativa: {String(client.additionalInfo.iniziativa)}</span>
                  )}
                  {client.additionalInfo.vendor_di_riferimento != null && (
                    <span className="text-sm">Vendor: {String(client.additionalInfo.vendor_di_riferimento)}</span>
                  )}
                </div>
              </div>
            )}
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
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Appartamenti consigliati (match)
            </h2>
            {(client.selectedAppartments?.length ?? 0) > 0 || (client.interestedAppartments?.length ?? 0) > 0 ? (
              <div className="space-y-2 text-sm">
                {client.selectedAppartments && client.selectedAppartments.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Selezionati: </span>
                    {client.selectedAppartments.length} appartamento/i
                  </div>
                )}
                {client.interestedAppartments && client.interestedAppartments.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Interessati: </span>
                    {client.interestedAppartments.length} appartamento/i
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
              I consigli di appartamenti in base al profilo del cliente saranno disponibili quando
              il modulo di matching sarà attivo. Una profilazione più completa migliora
              l’efficacia del match.
            </p>
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Nessun consiglio disponibile. Completa il profilo e abilita il matching per vedere
              qui gli appartamenti suggeriti.
            </div>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};
