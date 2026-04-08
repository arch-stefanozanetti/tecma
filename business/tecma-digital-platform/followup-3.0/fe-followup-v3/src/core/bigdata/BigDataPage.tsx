/**
 * Big Data: tab native (panoramica, Ads, Meta, GA4, funnel CRM, listings) + dati per sezione.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ExecutiveMarkdown } from "../executive/ExecutiveMarkdown";
import { Link } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DateInput } from "../../components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { MarketingBigDataConnectorsPanel } from "../integrations/MarketingBigDataConnectorsPanel";
import { RefreshCw } from "lucide-react";
import {
  mergeAdsCustomers,
  mergeGa4Properties,
  mergeMetaAdAccounts,
} from "../marketing/mergeDiscoveryWithSaved";
import {
  MarketingAdsPicker,
  MarketingGa4TwoPanePicker,
  MarketingMetaPicker,
} from "../marketing/MarketingResourcePickers";

const Ga4ChartsSectionLazy = lazy(() =>
  import("./Ga4ReportCharts").then((m) => ({ default: m.Ga4ChartsSection }))
);

type BigDataSection = "full" | "overview" | "ads" | "meta" | "ga4" | "funnel" | "listings";

type BigDataPayload = {
  section?: string;
  projectId?: string;
  workspaceId?: string;
  dateRange?: { from?: string; to?: string };
  attributionModel?: string;
  definitions?: Record<string, string>;
  funnelBridge?: {
    impressions?: number;
    clicks?: number;
    sessions?: number;
    leads?: number;
    sales?: number;
  };
  crm?: {
    channels?: Array<{
      key?: string;
      utmSource?: string;
      utmCampaign?: string;
      leads?: number;
      withAppointment?: number;
      withProposal?: number;
      sales?: number;
    }>;
    funnelTotals?: {
      leads?: number;
      appointments?: number;
      proposals?: number;
      sales?: number;
    };
    topApartments?: Array<{ apartmentId?: string; apartmentCode?: string; requestCount?: number }>;
  };
  listings?: {
    topPropertyViews?: Array<{ listingId?: string; apartmentId?: string; viewCount?: number }>;
  };
  marketing?: {
    googleAds?: { configured?: boolean; error?: string; customerId?: string; campaigns?: unknown[] };
    meta?: { configured?: boolean; error?: string; adAccountId?: string; campaigns?: unknown[] };
    ga4?: {
      configured?: boolean;
      error?: string;
      propertyId?: string;
      propertyDisplayName?: string;
      summary?: Record<string, number>;
      recommerceWeb?: {
        listingSampleRows?: number;
        aptDetailSampleRows?: number;
        topFilterDimensions?: Array<{ key?: string; value?: string; screenPageViews?: number }>;
        topAptViewsFromGa4?: Array<{ aptCode?: string; screenPageViews?: number }>;
        methodology?: string;
        error?: string;
      };
      report?: {
        trend?: Array<{ date?: string; sessions?: number; activeUsers?: number }>;
        trendUsers?: Array<{ date?: string; newUsers?: number; activeUsers?: number }>;
        channels?: Array<{ label?: string; sessions?: number }>;
        firstUserChannels?: Array<{ channel?: string; activeUsers?: number; newUsers?: number }>;
        devices?: Array<{ category?: string; sessions?: number; activeUsers?: number }>;
        firstUserAcquisition?: Array<{ sourceMedium?: string; sessions?: number; newUsers?: number }>;
        landingPages?: Array<{ path?: string; sessions?: number; activeUsers?: number }>;
        chartInsights?: string[];
      };
    };
  };
  reconciliationNotes?: string[];
  cachedAt?: string;
  cacheExpiresAt?: string;
};

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const TAB_TO_SECTION: Record<string, BigDataSection> = {
  overview: "overview",
  ads: "ads",
  meta: "meta",
  ga4: "ga4",
  funnel: "funnel",
  listings: "listings",
  full: "full",
};

function marketingSecretsIncomplete(d: BigDataPayload | null | undefined): boolean {
  const m = d?.marketing;
  if (!m) return false;
  return !m.googleAds?.configured || !m.meta?.configured || !m.ga4?.configured;
}

function marketingMissingProjectIds(d: BigDataPayload | null | undefined): boolean {
  const m = d?.marketing;
  if (!m) return false;
  if (m.googleAds?.configured === true && !String(m.googleAds.customerId ?? "").trim()) return true;
  if (m.meta?.configured === true && !String(m.meta.adAccountId ?? "").trim()) return true;
  if (m.ga4?.configured === true && !String(m.ga4.propertyId ?? "").trim()) return true;
  return false;
}

type MarketingShortcuts = { projectMarketingTo: string; integrationsTo: string };

export const BigDataPage = () => {
  const { workspaceId, selectedProjectIds, projects, hasPermission } = useWorkspace();
  const projectOptions = useMemo(() => {
    const byId = new Map((projects ?? []).map((p) => [p.id, p]));
    return selectedProjectIds.map((id) => {
      const p = byId.get(id);
      return {
        id,
        label: p?.displayName?.trim() || p?.name?.trim() || id,
      };
    });
  }, [projects, selectedProjectIds]);
  const canReadIntegrations = hasPermission("integrations.read");
  const integrationsReadOnly = !hasPermission("integrations.update");
  const { toastError, toastSuccess } = useToast();
  const [projectId, setProjectId] = useState<string>("");
  const dr = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(dr.from);
  const [dateTo, setDateTo] = useState(dr.to);
  const [attributionModel, setAttributionModel] = useState<"last_touch" | "first_touch">("last_touch");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [dataByTab, setDataByTab] = useState<Partial<Record<BigDataSection, BigDataPayload>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);
  const [projectMktLoading, setProjectMktLoading] = useState(false);
  const [savingProjectMkt, setSavingProjectMkt] = useState(false);
  const [projectMktDraft, setProjectMktDraft] = useState({
    googleAdsCustomerId: "",
    googleAdsLoginCustomerId: "",
    ga4PropertyId: "",
    metaAdAccountId: "",
    siteHostname: "",
  });
  const [mktAdsCustomers, setMktAdsCustomers] = useState<Array<{ customerId: string; resourceName: string }>>([]);
  const [mktGa4Props, setMktGa4Props] = useState<
    Array<{ propertyId: string; displayName: string; accountDisplayName?: string }>
  >([]);
  const [mktMetaAccounts, setMktMetaAccounts] = useState<Array<{ id: string; name?: string; accountId: string }>>([]);
  const [mktPickersLoading, setMktPickersLoading] = useState(false);
  const [mktPickerRefresh, setMktPickerRefresh] = useState(0);
  const [mktGa4LoadError, setMktGa4LoadError] = useState<string | null>(null);
  const [mktGa4LoadHint, setMktGa4LoadHint] = useState<string | null>(null);
  const [mktAdsLoadError, setMktAdsLoadError] = useState<string | null>(null);
  const [mktAdsLoadHint, setMktAdsLoadHint] = useState<string | null>(null);
  const [metricsTick, setMetricsTick] = useState(0);

  const adsPickOptions = useMemo(
    () => mergeAdsCustomers(mktAdsCustomers, projectMktDraft.googleAdsCustomerId),
    [mktAdsCustomers, projectMktDraft.googleAdsCustomerId]
  );
  const ga4PickOptions = useMemo(
    () => mergeGa4Properties(mktGa4Props, projectMktDraft.ga4PropertyId),
    [mktGa4Props, projectMktDraft.ga4PropertyId]
  );
  const metaPickOptions = useMemo(
    () => mergeMetaAdAccounts(mktMetaAccounts, projectMktDraft.metaAdAccountId),
    [mktMetaAccounts, projectMktDraft.metaAdAccountId]
  );

  const projectMarketingTo = useMemo(() => {
    if (!projectId || !workspaceId) return "";
    return `/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}#project-marketing-bigdata`;
  }, [projectId, workspaceId]);

  const integrationsTo = "/?section=integrations&tab=connettori";

  const shortcuts =
    projectMarketingTo && workspaceId
      ? { projectMarketingTo, integrationsTo }
      : undefined;

  useEffect(() => {
    if (!projectPanelOpen || !projectId || !workspaceId) return;
    setProjectMktLoading(true);
    followupApi.projects
      .getProjectMarketingSettings(projectId, workspaceId)
      .then((row) => {
        setProjectMktDraft({
          googleAdsCustomerId: row.googleAdsCustomerId ?? "",
          googleAdsLoginCustomerId: row.googleAdsLoginCustomerId ?? "",
          ga4PropertyId: row.ga4PropertyId ?? "",
          metaAdAccountId: row.metaAdAccountId ?? "",
          siteHostname: row.siteHostname ?? "",
        });
      })
      .catch(() => toastError("Impossibile caricare gli ID marketing del progetto."))
      .finally(() => setProjectMktLoading(false));
  }, [projectPanelOpen, projectId, workspaceId, toastError]);

  useEffect(() => {
    if (!projectPanelOpen || !workspaceId) return;
    let cancelled = false;
    setMktPickersLoading(true);
    setMktGa4LoadError(null);
    setMktGa4LoadHint(null);
    setMktAdsLoadError(null);
    setMktAdsLoadHint(null);
    void Promise.all([
      followupApi
        .getMarketingGoogleAdsCustomers(workspaceId)
        .then((r) => ({ adsOk: true as const, customers: r.customers ?? [] }))
        .catch((err: unknown) => ({ adsOk: false as const, err })),
      followupApi
        .getMarketingGoogleGa4Properties(workspaceId)
        .then((r) => ({ ga4Ok: true as const, properties: r.properties ?? [] }))
        .catch((err: unknown) => ({ ga4Ok: false as const, err })),
      followupApi.getMarketingMetaAdAccounts(workspaceId).catch(() => ({ adAccounts: [] as { id: string; name?: string; accountId: string }[] })),
    ])
      .then(([ads, ga4, m]) => {
        if (cancelled) return;
        setMktMetaAccounts(m.adAccounts ?? []);
        if (ads.adsOk) {
          setMktAdsCustomers(ads.customers);
          setMktAdsLoadError(null);
          setMktAdsLoadHint(null);
        } else {
          setMktAdsCustomers([]);
          const e = ads.err;
          if (e instanceof HttpApiError) {
            setMktAdsLoadError(e.message);
            setMktAdsLoadHint(e.hint ?? null);
          } else {
            setMktAdsLoadError(e instanceof Error ? e.message : "Errore durante il caricamento degli account Google Ads.");
            setMktAdsLoadHint(null);
          }
        }
        if (ga4.ga4Ok) {
          setMktGa4Props(ga4.properties);
          setMktGa4LoadError(null);
          setMktGa4LoadHint(null);
        } else {
          setMktGa4Props([]);
          const e = ga4.err;
          if (e instanceof HttpApiError) {
            setMktGa4LoadError(e.message);
            setMktGa4LoadHint(e.hint ?? null);
          } else {
            setMktGa4LoadError(e instanceof Error ? e.message : "Errore durante il caricamento delle proprietà GA4.");
            setMktGa4LoadHint(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setMktPickersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPanelOpen, workspaceId, mktPickerRefresh]);

  useEffect(() => {
    if (selectedProjectIds.length > 0 && !projectId) {
      setProjectId(selectedProjectIds[0] ?? "");
    }
  }, [selectedProjectIds, projectId]);

  const section = TAB_TO_SECTION[activeTab] ?? "overview";

  const load = useCallback(
    async (sec: BigDataSection) => {
      if (!workspaceId || !projectId) return;
      setLoading(true);
      setError(null);
      try {
        const fromIso = `${dateFrom}T00:00:00.000Z`;
        const toIso = `${dateTo}T23:59:59.999Z`;
        const res = await followupApi.getBigDataProject(projectId, {
          workspaceId,
          dateFrom: fromIso,
          dateTo: toIso,
          attributionModel,
          section: sec === "full" ? undefined : sec,
        });
        const payload = (res.data as BigDataPayload) ?? {};
        setDataByTab((prev) => ({ ...prev, [sec]: payload }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore caricamento Big Data");
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, projectId, dateFrom, dateTo, attributionModel]
  );

  const saveProjectMarketingInline = useCallback(async () => {
    if (!projectId || !workspaceId) return;
    setSavingProjectMkt(true);
    try {
      await followupApi.projects.putProjectMarketingSettings(projectId, workspaceId, {
        googleAdsCustomerId: projectMktDraft.googleAdsCustomerId || null,
        googleAdsLoginCustomerId: projectMktDraft.googleAdsLoginCustomerId || null,
        ga4PropertyId: projectMktDraft.ga4PropertyId || null,
        metaAdAccountId: projectMktDraft.metaAdAccountId || null,
        siteHostname: projectMktDraft.siteHostname || null,
      });
      toastSuccess("ID marketing progetto salvati.");
      void load(section);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSavingProjectMkt(false);
    }
  }, [
    projectId,
    workspaceId,
    projectMktDraft,
    toastSuccess,
    toastError,
    load,
    section,
  ]);

  useEffect(() => {
    if (!workspaceId || !projectId) return;
    void load(section);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load ricreato ogni render; dipendenze esplicite sotto
  }, [workspaceId, projectId, section, dateFrom, dateTo, attributionModel, metricsTick]);

  useEffect(() => {
    if (!workspaceId || !projectId) return;
    const unsubscribe = followupApi.subscribeRealtimeEvents(
      workspaceId,
      { eventTypes: ["metrics.updated"], projectId },
      () => setMetricsTick((v) => v + 1)
    );
    return () => unsubscribe();
  }, [workspaceId, projectId]);

  const data = dataByTab[section] ?? null;
  const showSetupBanner =
    Boolean(data && workspaceId && projectId) &&
    (marketingSecretsIncomplete(data) || marketingMissingProjectIds(data));
  const setupBannerMessage =
    data && marketingSecretsIncomplete(data)
      ? "Mancano uno o più secret a livello workspace (token Meta, JSON GA4, OAuth Google Ads) oppure gli ID account sul progetto. Usa i link o apri i pannelli qui sotto per configurare senza uscire dalla pagina."
      : "I secret risultano presenti ma mancano gli ID progetto (customer Google Ads, property GA4, account Meta). Compilali nella scheda progetto o nel modulo qui sotto.";
  const totals = data?.crm?.funnelTotals;
  const channels = data?.crm?.channels ?? [];
  const topApt = data?.crm?.topApartments ?? [];
  const topViews = data?.listings?.topPropertyViews ?? [];
  const bridge = data?.funnelBridge;

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Big Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Report multipagina per progetto. ID account (Ads, GA4, Meta){" "}
          {shortcuts ? (
            <>
              in{" "}
              <Link
                to={shortcuts.projectMarketingTo}
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Progetti → Marketing / Big Data
              </Link>
            </>
          ) : (
            <>
              in <span className="font-medium text-foreground">Progetti → Marketing / Big Data</span>
            </>
          )}
          ; token in{" "}
          {shortcuts ? (
            <Link
              to={shortcuts.integrationsTo}
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              Integrazioni (Connettori)
            </Link>
          ) : (
            <span className="font-medium text-foreground">Integrazioni</span>
          )}
          . Il developer token Google Ads resta in env server.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold text-foreground">Definizioni</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{data?.definitions?.lead ?? "Lead = nuovo cliente creato nel periodo."}</li>
            <li>{data?.definitions?.appointment ?? "Appuntamento = evento calendario con cliente nel periodo."}</li>
            <li>{data?.definitions?.proposal ?? "Proposta = trattativa in preventivo/offerta aggiornata nel periodo."}</li>
            <li>{data?.definitions?.sale ?? "Vendita = trattativa vinta (won) aggiornata nel periodo."}</li>
            <li>{data?.definitions?.attribution ?? "Attribuzione: last o first touch salvato sul cliente."}</li>
            {data?.definitions?.propertyView && <li>{data.definitions.propertyView}</li>}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Progetto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona progetto" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Da</label>
            <DateInput aria-label="Intervallo da" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">A</label>
            <DateInput aria-label="Intervallo a" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(activeTab === "funnel" || activeTab === "full") && (
            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground">Modello attribuzione</label>
              <Select value={attributionModel} onValueChange={(v) => setAttributionModel(v as "last_touch" | "first_touch")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_touch">Last touch</SelectItem>
                  <SelectItem value="first_touch">First touch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="button" onClick={() => void load(section)} disabled={loading || !workspaceId || !projectId}>
            {loading ? "Caricamento…" : "Aggiorna"}
          </Button>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {showSetupBanner && shortcuts && (
          <Alert
            variant="warning"
            title="Configurazione marketing incompleta"
            className="mt-4"
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="default">
                  <Link to={shortcuts.projectMarketingTo}>Apri scheda progetto</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={shortcuts.integrationsTo}>Apri Integrazioni</Link>
                </Button>
                {canReadIntegrations && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setWorkspacePanelOpen((o) => !o)}
                  >
                    {workspacePanelOpen ? "Nascondi token workspace" : "Configura token qui"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={() => setProjectPanelOpen((o) => !o)}>
                  {projectPanelOpen ? "Nascondi ID progetto" : "Configura ID progetto qui"}
                </Button>
              </div>
            }
          >
            {setupBannerMessage}
          </Alert>
        )}

        {workspacePanelOpen && workspaceId && canReadIntegrations && (
          <MarketingBigDataConnectorsPanel
            workspaceId={workspaceId}
            readOnly={integrationsReadOnly}
            className="!mt-4"
          />
        )}

        {projectPanelOpen && workspaceId && projectId && (
          <div className="mt-4 rounded-lg border border-border bg-card/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Account marketing (solo scelta da API)</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Elenchi da Google Ads, GA4 e Meta come in Progetti → Marketing / Big Data. Dopo il salvataggio premi &quot;Aggiorna&quot;.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                disabled={mktPickersLoading}
                onClick={() => setMktPickerRefresh((n) => n + 1)}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", mktPickersLoading && "animate-spin")} />
                Ricarica elenchi
              </Button>
            </div>
            {projectMktLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Caricamento…</p>
            ) : (
              <div className="mt-4 space-y-4">
                {mktPickersLoading && (
                  <p className="text-xs text-muted-foreground">Aggiornamento elenchi da API…</p>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Google Ads</label>
                  <MarketingAdsPicker
                    className="mt-1"
                    options={adsPickOptions}
                    value={projectMktDraft.googleAdsCustomerId}
                    onChange={(googleAdsCustomerId) =>
                      setProjectMktDraft((d) => ({ ...d, googleAdsCustomerId }))
                    }
                    loadError={mktAdsLoadError}
                    loadErrorHint={mktAdsLoadHint}
                    emptyHint="Google è collegato ma non risultano customer accessibili da API. Verifica accesso in ads.google.com e premi Ricarica elenchi."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Google Analytics 4</label>
                  <MarketingGa4TwoPanePicker
                    className="mt-1"
                    properties={ga4PickOptions}
                    value={projectMktDraft.ga4PropertyId}
                    onChange={(ga4PropertyId) => setProjectMktDraft((d) => ({ ...d, ga4PropertyId }))}
                    loadError={mktGa4LoadError}
                    loadErrorHint={mktGa4LoadHint}
                    emptyHintAccounts="Google risulta collegato ma non risultano proprietà GA4 da elencare. Verifica su analytics.google.com che l’utente usato in OAuth abbia accesso ad almeno una proprietà GA4, poi premi Ricarica elenchi."
                    emptyHintProperties="Se l’accesso GA4 è corretto, controlla nel progetto Google Cloud dell’OAuth marketing che sia abilitata l’API «Google Analytics Admin». In caso di dubbio, disconnetti e ricollega Google in Integrazioni."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Meta</label>
                  <MarketingMetaPicker
                    className="mt-1"
                    options={metaPickOptions}
                    value={projectMktDraft.metaAdAccountId}
                    onChange={(metaAdAccountId) => setProjectMktDraft((d) => ({ ...d, metaAdAccountId }))}
                    emptyHint="Nessun account dall'API. Collega Meta in Integrazioni."
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingProjectMkt}
                  onClick={() => void saveProjectMarketingInline()}
                >
                  {savingProjectMkt ? "Salvataggio…" : "Salva scelte progetto"}
                </Button>
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Panoramica
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-xs sm:text-sm">
              Google Ads
            </TabsTrigger>
            <TabsTrigger value="meta" className="text-xs sm:text-sm">
              Meta
            </TabsTrigger>
            <TabsTrigger value="ga4" className="text-xs sm:text-sm">
              GA4
            </TabsTrigger>
            <TabsTrigger value="funnel" className="text-xs sm:text-sm">
              Funnel CRM
            </TabsTrigger>
            <TabsTrigger value="listings" className="text-xs sm:text-sm">
              Listings
            </TabsTrigger>
            <TabsTrigger value="full" className="text-xs sm:text-sm">
              Tutto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {data && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Lead (nuovi clienti)", value: totals?.leads ?? 0 },
                    { label: "Appuntamenti", value: totals?.appointments ?? 0 },
                    { label: "Proposte", value: totals?.proposals ?? 0 },
                    { label: "Vendite", value: totals?.sales ?? 0 },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>
                {(bridge?.impressions != null ||
                  bridge?.clicks != null ||
                  bridge?.sessions != null ||
                  bridge?.leads != null ||
                  bridge?.sales != null) && (
                  <div className="rounded-lg border border-border bg-card/40 p-4">
                    <h2 className="text-sm font-semibold">Ponticello marketing → CRM</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Impression/click da Ads+Meta (se API cablate); sessioni da GA4; lead e vendite da CRM.
                    </p>
                    <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {bridge.impressions != null && (
                        <li>
                          <span className="text-muted-foreground">Impression (Ads+Meta):</span>{" "}
                          <span className="font-mono tabular-nums">{bridge.impressions}</span>
                        </li>
                      )}
                      {bridge.clicks != null && (
                        <li>
                          <span className="text-muted-foreground">Click (Ads+Meta):</span>{" "}
                          <span className="font-mono tabular-nums">{bridge.clicks}</span>
                        </li>
                      )}
                      {bridge.sessions != null && (
                        <li>
                          <span className="text-muted-foreground">Sessioni GA4:</span>{" "}
                          <span className="font-mono tabular-nums">{bridge.sessions}</span>
                        </li>
                      )}
                      <li>
                        <span className="text-muted-foreground">Lead CRM:</span>{" "}
                        <span className="font-mono tabular-nums">{bridge.leads ?? totals?.leads ?? 0}</span>
                      </li>
                      <li>
                        <span className="text-muted-foreground">Vendite CRM:</span>{" "}
                        <span className="font-mono tabular-nums">{bridge.sales ?? totals?.sales ?? 0}</span>
                      </li>
                    </ul>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold">Visualizzazioni listing (first-party)</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {topViews.length === 0 ? (
                      <li>Nessun evento property-views nel periodo.</li>
                    ) : (
                      topViews.map((v, i) => (
                        <li key={`${v.listingId ?? ""}-${v.apartmentId ?? ""}-${i}`}>
                          {v.listingId && <span className="font-mono text-foreground">listing {v.listingId}</span>}
                          {v.apartmentId && <span className="font-mono text-foreground">apt {v.apartmentId}</span>}
                          {" — "}
                          {v.viewCount} visualizzazioni
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <MarketingStatusBlock data={data} shortcuts={shortcuts} />
              </>
            )}
          </TabsContent>

          <TabsContent value="ads" className="mt-6">
            {data && <GoogleAdsBlock data={data} shortcuts={shortcuts} />}
          </TabsContent>
          <TabsContent value="meta" className="mt-6">
            {data && <MetaBlock data={data} shortcuts={shortcuts} />}
          </TabsContent>
          <TabsContent value="ga4" className="mt-6">
            {data && <Ga4Block data={data} shortcuts={shortcuts} />}
          </TabsContent>

          <TabsContent value="funnel" className="mt-6 space-y-6">
            {data && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Lead", value: totals?.leads ?? 0 },
                    { label: "Appuntamenti", value: totals?.appointments ?? 0 },
                    { label: "Proposte", value: totals?.proposals ?? 0 },
                    { label: "Vendite", value: totals?.sales ?? 0 },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Canali (CRM)</h2>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Sorgente</th>
                          <th className="p-3">Campagna</th>
                          <th className="p-3 text-right">Lead</th>
                          <th className="p-3 text-right">Con appuntamento</th>
                          <th className="p-3 text-right">Con proposta</th>
                          <th className="p-3 text-right">Vendite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-muted-foreground">
                              Nessun lead nel periodo con dati di attribuzione.
                            </td>
                          </tr>
                        ) : (
                          channels.map((row) => (
                            <tr key={row.key} className="border-t border-border">
                              <td className="p-3 font-mono text-xs">{row.utmSource}</td>
                              <td className="p-3 font-mono text-xs">{row.utmCampaign}</td>
                              <td className="p-3 text-right tabular-nums">{row.leads}</td>
                              <td className="p-3 text-right tabular-nums">{row.withAppointment}</td>
                              <td className="p-3 text-right tabular-nums">{row.withProposal}</td>
                              <td className="p-3 text-right tabular-nums">{row.sales}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="listings" className="mt-6 space-y-8">
            {data && (
              <>
                <div>
                  <h2 className="text-lg font-semibold">Appartamenti con più trattative</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {topApt.length === 0 ? (
                      <li>Nessun dato nel periodo.</li>
                    ) : (
                      topApt.map((a) => (
                        <li key={a.apartmentId}>
                          <span className="font-mono text-foreground">{a.apartmentCode ?? a.apartmentId}</span> — {a.requestCount}{" "}
                          trattative
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Listing più visti (eventi sito)</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {topViews.length === 0 ? (
                      <li>Nessun evento nel periodo. Inviare POST /v1/platform/property-views dalla property page.</li>
                    ) : (
                      topViews.map((v, i) => (
                        <li key={`${v.listingId ?? ""}-${v.apartmentId ?? ""}-${i}`}>
                          {v.listingId && <span className="font-mono text-foreground">listing {v.listingId}</span>}
                          {v.apartmentId && <span className="font-mono text-foreground">apt {v.apartmentId}</span>}
                          {" — "}
                          {v.viewCount} visualizzazioni
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <Ga4VisualReportBlock data={data} />
                <RecommerceGa4Section data={data} context="listings" />
              </>
            )}
          </TabsContent>

          <TabsContent value="full" className="mt-6 space-y-8">
            {data && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Lead (nuovi clienti)", value: totals?.leads ?? 0 },
                    { label: "Appuntamenti", value: totals?.appointments ?? 0 },
                    { label: "Proposte", value: totals?.proposals ?? 0 },
                    { label: "Vendite", value: totals?.sales ?? 0 },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>
                {bridge && (
                  <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
                    <p className="font-semibold">Ponticello marketing → CRM</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {bridge.impressions != null && <li>Impression: {bridge.impressions}</li>}
                      {bridge.clicks != null && <li>Click: {bridge.clicks}</li>}
                      {bridge.sessions != null && <li>Sessioni GA4: {bridge.sessions}</li>}
                      <li>Lead: {bridge.leads}</li>
                      <li>Vendite: {bridge.sales}</li>
                    </ul>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold">Canali (CRM)</h2>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Sorgente</th>
                          <th className="p-3">Campagna</th>
                          <th className="p-3 text-right">Lead</th>
                          <th className="p-3 text-right">Con appuntamento</th>
                          <th className="p-3 text-right">Con proposta</th>
                          <th className="p-3 text-right">Vendite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-muted-foreground">
                              Nessun lead nel periodo con dati di attribuzione.
                            </td>
                          </tr>
                        ) : (
                          channels.map((row) => (
                            <tr key={row.key} className="border-t border-border">
                              <td className="p-3 font-mono text-xs">{row.utmSource}</td>
                              <td className="p-3 font-mono text-xs">{row.utmCampaign}</td>
                              <td className="p-3 text-right tabular-nums">{row.leads}</td>
                              <td className="p-3 text-right tabular-nums">{row.withAppointment}</td>
                              <td className="p-3 text-right tabular-nums">{row.withProposal}</td>
                              <td className="p-3 text-right tabular-nums">{row.sales}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Appartamenti più richiesti (trattative)</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {topApt.length === 0 ? (
                      <li>Nessun dato nel periodo.</li>
                    ) : (
                      topApt.map((a) => (
                        <li key={a.apartmentId}>
                          <span className="font-mono text-foreground">{a.apartmentCode ?? a.apartmentId}</span> — {a.requestCount}{" "}
                          trattative
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Listing più visti</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {topViews.length === 0 ? (
                      <li>Nessun evento nel periodo.</li>
                    ) : (
                      topViews.map((v, i) => (
                        <li key={`${v.listingId ?? ""}-${v.apartmentId ?? ""}-${i}`}>
                          {v.listingId && <span className="font-mono text-foreground">listing {v.listingId}</span>}
                          {v.apartmentId && <span className="font-mono text-foreground">apt {v.apartmentId}</span>}
                          {" — "}
                          {v.viewCount} visualizzazioni
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <Ga4VisualReportBlock data={data} />
                <RecommerceGa4Section data={data} context="ga4" />
                <MarketingStatusBlock data={data} shortcuts={shortcuts} />
                {(data.reconciliationNotes?.length ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Note</p>
                    <ul className="mt-1 list-disc pl-5">
                      {data.reconciliationNotes!.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Cache fino a {data.cacheExpiresAt ? new Date(data.cacheExpiresAt).toLocaleString() : "—"}
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>

        {data && activeTab !== "full" && (data.reconciliationNotes?.length ?? 0) > 0 && (
          <div className="mt-6 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Note</p>
            <ul className="mt-1 list-disc pl-5">
              {data.reconciliationNotes!.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {data && activeTab !== "full" && (
          <p className="mt-4 text-xs text-muted-foreground">
            Cache fino a {data.cacheExpiresAt ? new Date(data.cacheExpiresAt).toLocaleString() : "—"}
          </p>
        )}
      </div>
    </div>
  );
};

function MarketingShortcutLinks({ shortcuts }: { shortcuts?: MarketingShortcuts }) {
  if (!shortcuts) return null;
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      <Link to={shortcuts.projectMarketingTo} className="text-primary underline underline-offset-2 hover:no-underline">
        ID in scheda progetto
      </Link>
      <span className="mx-1.5 text-border">·</span>
      <Link to={shortcuts.integrationsTo} className="text-primary underline underline-offset-2 hover:no-underline">
        Token in Integrazioni
      </Link>
    </span>
  );
}

function MarketingStatusBlock({
  data,
  shortcuts,
}: {
  data: BigDataPayload;
  shortcuts?: MarketingShortcuts;
}) {
  const gAdsGap =
    !data.marketing?.googleAds?.configured ||
    (data.marketing?.googleAds?.configured === true && !String(data.marketing?.googleAds?.customerId ?? "").trim());
  const metaGap =
    !data.marketing?.meta?.configured ||
    (data.marketing?.meta?.configured === true && !String(data.marketing?.meta?.adAccountId ?? "").trim());
  const ga4Gap =
    !data.marketing?.ga4?.configured ||
    (data.marketing?.ga4?.configured === true && !String(data.marketing?.ga4?.propertyId ?? "").trim());

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <h2 className="text-sm font-semibold">Stato connettori</h2>
      <ul className="mt-2 space-y-3 text-sm">
        <li>
          <span className="text-foreground">
            Google Ads: {data.marketing?.googleAds?.configured ? "configurato" : "non configurato"}
            {data.marketing?.googleAds?.customerId ? ` (customer ${data.marketing.googleAds.customerId})` : ""}
            {data.marketing?.googleAds?.error ? ` — ${data.marketing.googleAds.error}` : ""}
          </span>
          {gAdsGap && <MarketingShortcutLinks shortcuts={shortcuts} />}
        </li>
        <li>
          <span className="text-foreground">
            Meta: {data.marketing?.meta?.configured ? "configurato" : "non configurato"}
            {data.marketing?.meta?.adAccountId ? ` (${data.marketing.meta.adAccountId})` : ""}
            {data.marketing?.meta?.error ? ` — ${data.marketing.meta.error}` : ""}
          </span>
          {metaGap && <MarketingShortcutLinks shortcuts={shortcuts} />}
        </li>
        <li>
          <span className="text-foreground">
            GA4: {data.marketing?.ga4?.configured ? "configurato" : "non configurato"}
            {data.marketing?.ga4?.propertyDisplayName
              ? ` — ${data.marketing.ga4.propertyDisplayName}`
              : data.marketing?.ga4?.propertyId
                ? ` (property ${data.marketing.ga4.propertyId})`
                : ""}
            {data.marketing?.ga4?.error ? ` — ${data.marketing.ga4.error}` : ""}
          </span>
          {ga4Gap && <MarketingShortcutLinks shortcuts={shortcuts} />}
        </li>
      </ul>
    </div>
  );
}

function GoogleAdsBlock({ data, shortcuts }: { data: BigDataPayload; shortcuts?: MarketingShortcuts }) {
  const g = data.marketing?.googleAds;
  const needsSetup =
    !g?.configured || (g?.configured === true && !String(g?.customerId ?? "").trim());
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
      <h2 className="text-lg font-semibold">Google Ads</h2>
      <p className="text-sm text-muted-foreground">
        Stato: {g?.configured ? "configurato" : "non configurato"}
        {g?.customerId ? ` — customer ID ${g.customerId}` : ""}
      </p>
      {g?.error && <p className="text-sm text-amber-700 dark:text-amber-300">{g.error}</p>}
      {needsSetup && <MarketingShortcutLinks shortcuts={shortcuts} />}
      <p className="text-xs text-muted-foreground">Campagne: {(g?.campaigns?.length ?? 0) > 0 ? `${g!.campaigns!.length} righe` : "nessun dato (stub API)."}</p>
    </div>
  );
}

function MetaBlock({ data, shortcuts }: { data: BigDataPayload; shortcuts?: MarketingShortcuts }) {
  const m = data.marketing?.meta;
  const needsSetup =
    !m?.configured || (m?.configured === true && !String(m?.adAccountId ?? "").trim());
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
      <h2 className="text-lg font-semibold">Meta Ads</h2>
      <p className="text-sm text-muted-foreground">
        Stato: {m?.configured ? "configurato" : "non configurato"}
        {m?.adAccountId ? ` — ${m.adAccountId}` : ""}
      </p>
      {m?.error && <p className="text-sm text-amber-700 dark:text-amber-300">{m.error}</p>}
      {needsSetup && <MarketingShortcutLinks shortcuts={shortcuts} />}
    </div>
  );
}

function Ga4VisualReportBlock({ data }: { data: BigDataPayload }) {
  const { workspaceId: wsFromHook, hasPermission } = useWorkspace();
  const { toastError } = useToast();
  const rep = data.marketing?.ga4?.report;
  const g = data.marketing?.ga4;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const workspaceId = (data.workspaceId ?? wsFromHook ?? "").trim();
  const projectId = (data.projectId ?? "").trim();
  const dateFrom = (data.dateRange?.from ?? "").trim();
  const dateTo = (data.dateRange?.to ?? "").trim();
  const canRequestAiNarrative =
    hasPermission("reports.read") && workspaceId && projectId && dateFrom && dateTo && g?.configured;

  const runAiNarrative = useCallback(async () => {
    if (!canRequestAiNarrative) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await followupApi.postGa4BigDataAiNarrative(projectId, {
        workspaceId,
        dateFrom,
        dateTo,
      });
      setAiMarkdown(res.data.markdown);
    } catch (e) {
      const msg = e instanceof HttpApiError ? e.message : e instanceof Error ? e.message : "Errore sintesi IA";
      setAiError(msg);
      toastError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [canRequestAiNarrative, dateFrom, dateTo, projectId, toastError, workspaceId]);

  if (!g?.configured || !rep) return null;

  return (
    <div className="space-y-4">
      {rep.chartInsights && rep.chartInsights.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/15 p-4">
          <h3 className="text-sm font-semibold text-foreground">Rilevamenti rapidi (regole sui grafici)</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {rep.chartInsights.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Elaborazione automatica su metriche aggregate (non generata da modello linguistico).
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Sintesi con IA</h3>
          <Button type="button" variant="secondary" size="sm" disabled={!canRequestAiNarrative || aiLoading} onClick={runAiNarrative}>
            {aiLoading ? "Generazione…" : "Genera sintesi IA"}
          </Button>
        </div>
        {!canRequestAiNarrative && (
          <p className="text-xs text-muted-foreground">
            Per la sintesi servono workspace, progetto, intervallo date e GA4 configurato; in Workspaces va impostata anche la configurazione AI (provider e chiave).
          </p>
        )}
        {aiError && <p className="text-sm text-amber-700 dark:text-amber-300">{aiError}</p>}
        {aiMarkdown && (
          <div className="prose prose-sm dark:prose-invert max-w-none border-t border-border pt-3">
            <ExecutiveMarkdown source={aiMarkdown} />
          </div>
        )}
      </div>

      <Suspense
        fallback={
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Caricamento grafici…
          </p>
        }
      >
        <Ga4ChartsSectionLazy
          trend={(rep.trend ?? []).map((t) => ({
            date: String(t.date ?? ""),
            sessions: Number(t.sessions ?? 0),
            activeUsers: Number(t.activeUsers ?? 0),
          }))}
          trendUsers={(rep.trendUsers ?? []).map((t) => ({
            date: String(t.date ?? ""),
            newUsers: Number(t.newUsers ?? 0),
            activeUsers: Number(t.activeUsers ?? 0),
          }))}
          channels={(rep.channels ?? []).map((c) => ({
            label: String(c.label ?? ""),
            sessions: Number(c.sessions ?? 0),
          }))}
          firstUserChannels={(rep.firstUserChannels ?? []).map((r) => ({
            channel: String(r.channel ?? ""),
            activeUsers: Number(r.activeUsers ?? 0),
            newUsers: Number(r.newUsers ?? 0),
          }))}
          devices={(rep.devices ?? []).map((d) => ({
            category: String(d.category ?? ""),
            sessions: Number(d.sessions ?? 0),
            activeUsers: Number(d.activeUsers ?? 0),
          }))}
          firstUserAcquisition={(rep.firstUserAcquisition ?? []).map((r) => ({
            sourceMedium: String(r.sourceMedium ?? ""),
            sessions: Number(r.sessions ?? 0),
            newUsers: Number(r.newUsers ?? 0),
          }))}
          landingPages={(rep.landingPages ?? []).map((p) => ({
            path: String(p.path ?? ""),
            sessions: Number(p.sessions ?? 0),
            activeUsers: Number(p.activeUsers ?? 0),
          }))}
        />
      </Suspense>
    </div>
  );
}

function ga4FilterKeyLabel(key: string | undefined): string {
  switch (key) {
    case "typology":
      return "Tipologia";
    case "floor":
      return "Piano";
    case "surface":
      return "Superficie";
    case "price":
      return "Prezzo";
    default:
      return key ?? "—";
  }
}

function RecommerceGa4Section({
  data,
  context,
}: {
  data: BigDataPayload;
  context: "ga4" | "listings";
}) {
  const rc = data.marketing?.ga4?.recommerceWeb;
  const g = data.marketing?.ga4;
  if (!g?.configured) return null;

  if (!rc) {
    return (
      <div className="rounded-lg border border-border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        Report listino web (filtri + schede da URL) non presente in questo snapshot: OAuth Google attivo su
        Integrazioni, proprietà GA4 sul progetto, e caricamento da tab GA4, Listings o Tutto (backend aggiornato).
      </div>
    );
  }

  const filters = rc.topFilterDimensions ?? [];
  const apts = rc.topAptViewsFromGa4 ?? [];

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card/40 p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {context === "ga4" ? "Listino web (recommerce)" : "GA4 — listino web (recommerce)"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Filtri lista e schede da <span className="font-mono">pagePathPlusQueryString</span> su path{" "}
          <span className="font-mono">/appartamenti</span>, <span className="font-mono">/listing</span>,{" "}
          <span className="font-mono">/appartamento?apt=…</span>. Campionamento GA4: lista{" "}
          {rc.listingSampleRows ?? "—"} righe, schede {rc.aptDetailSampleRows ?? "—"} righe.
        </p>
        {rc.methodology && <p className="mt-2 text-xs text-muted-foreground">{rc.methodology}</p>}
        {rc.error && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{rc.error}</p>}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground">Valori filtro più visti (aggregati)</h4>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Dimensione</th>
                <th className="p-3">Valore</th>
                <th className="p-3 text-right">Viste pagina</th>
              </tr>
            </thead>
            <tbody>
              {filters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-muted-foreground">
                    Nessun parametro noto nella query (o traffico assente). Allineare i nomi query al sito (typology,
                    floor, surface, price) oppure usare eventi GTM dedicati.
                  </td>
                </tr>
              ) : (
                filters.map((row, i) => (
                  <tr key={`${row.key}-${row.value}-${i}`} className="border-t border-border">
                    <td className="p-3">{ga4FilterKeyLabel(row.key)}</td>
                    <td className="p-3 font-mono text-xs">{row.value}</td>
                    <td className="p-3 text-right tabular-nums">{row.screenPageViews ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground">Schede appartamento (GA4, param apt)</h4>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Codice apt</th>
                <th className="p-3 text-right">Viste pagina</th>
              </tr>
            </thead>
            <tbody>
              {apts.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-4 text-muted-foreground">
                    Nessuna vista su path <span className="font-mono">/appartamento?apt=…</span> nel campione.
                  </td>
                </tr>
              ) : (
                apts.map((row) => (
                  <tr key={row.aptCode} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{row.aptCode}</td>
                    <td className="p-3 text-right tabular-nums">{row.screenPageViews ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Ga4Block({ data, shortcuts }: { data: BigDataPayload; shortcuts?: MarketingShortcuts }) {
  const g = data.marketing?.ga4;
  const summary = g?.summary ?? {};
  const hasNumericMetrics =
    typeof summary.sessions === "number" ||
    typeof summary.activeUsers === "number" ||
    typeof summary.aptPageViews === "number";
  const needsSetup =
    !g?.configured || (g?.configured === true && !String(g?.propertyId ?? "").trim());
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">GA4</h2>
        <p className="text-sm text-muted-foreground">
          Stato: {g?.configured ? "configurato" : "non configurato"}
          {g?.propertyDisplayName
            ? ` — ${g.propertyDisplayName}`
            : g?.propertyId
              ? ` — property ${g.propertyId}`
              : ""}
        </p>
        {g?.configured && hasNumericMetrics && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {typeof summary.sessions === "number" ? (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Sessioni</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{summary.sessions}</p>
              </div>
            ) : null}
            {typeof summary.activeUsers === "number" ? (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Utenti attivi</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{summary.activeUsers}</p>
              </div>
            ) : null}
            {typeof summary.aptPageViews === "number" ? (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Visualizzazioni pagina / schermo</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{summary.aptPageViews}</p>
              </div>
            ) : null}
          </div>
        )}
        {g?.error && <p className="text-sm text-amber-700 dark:text-amber-300">{g.error}</p>}
        {needsSetup && <MarketingShortcutLinks shortcuts={shortcuts} />}
      </div>
      <Ga4VisualReportBlock data={data} />
      <RecommerceGa4Section data={data} context="ga4" />
    </div>
  );
}
