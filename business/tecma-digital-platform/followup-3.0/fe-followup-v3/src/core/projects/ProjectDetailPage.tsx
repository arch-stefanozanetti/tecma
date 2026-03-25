/**
 * Pagina dettaglio e configurazione progetto.
 * Sezioni: Identità, Contatti, Tecnica, Note legali e privacy, Email, PDF templates, Altri strumenti.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import {
  ChevronDown,
  Mail,
  FileText,
  Settings,
  Link2,
  ArrowLeft,
  Globe,
  Phone,
  BookOpen,
  KeyRound,
  ToggleLeft,
  Save,
  Palette,
  Users,
  UserPlus,
  LayoutDashboard,
  SlidersHorizontal,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type { ProjectAccessRow } from "../../types/domain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
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

const SectionTitle = ({
  label,
  icon,
  open,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="flex w-full items-center justify-between border-b border-border pb-2 pt-5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
    onClick={onToggle}
  >
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
    <ChevronDown className={cn("h-4 w-4 transition-transform text-muted-foreground", open && "rotate-180")} />
  </button>
);

const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
  </div>
);

type ProjectDoc = {
  id: string; name: string; displayName: string; mode: "rent" | "sell";
  city?: string; payoff?: string;
  contactEmail?: string; contactPhone?: string; projectUrl?: string;
  customDomain?: string; defaultLang?: string;
  hostKey?: string; assetKey?: string; feVendorKey?: string;
  automaticQuoteEnabled?: boolean; accountManagerEnabled?: boolean; hasDAS?: boolean;
  broker?: string | null; iban?: string;
};

type PoliciesDoc = {
  privacyPolicyUrl?: string; termsUrl?: string; content?: string; legalNotes?: string;
};

const emptyProject = (): Omit<ProjectDoc, "id"> => ({
  name: "", displayName: "", mode: "sell",
  city: "", payoff: "",
  contactEmail: "", contactPhone: "", projectUrl: "",
  customDomain: "", defaultLang: "it",
  hostKey: "", assetKey: "", feVendorKey: "",
  automaticQuoteEnabled: false, accountManagerEnabled: false, hasDAS: false,
  broker: "", iban: "",
});

const emptyPolicies = (): PoliciesDoc => ({
  privacyPolicyUrl: "", termsUrl: "", content: "", legalNotes: "",
});

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaceId: scopeWorkspaceId } = useWorkspace();
  const { toastError } = useToast();
  const workspaceId = searchParams.get("workspaceId") ?? scopeWorkspaceId ?? "";

  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ _id: string; name: string; subject: string }>>([]);
  const [pdfTemplates, setPdfTemplates] = useState<Array<{ _id: string; name: string; templateKey: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [identityDraft, setIdentityDraft] = useState(emptyProject());
  const [policiesDraft, setPoliciesDraft] = useState(emptyPolicies());
  const [brandingDraft, setBrandingDraft] = useState({ logoUrl: "", primaryColor: "", footerText: "" });
  const [marketingDraft, setMarketingDraft] = useState({
    googleAdsCustomerId: "",
    googleAdsLoginCustomerId: "",
    ga4PropertyId: "",
    metaAdAccountId: "",
    siteHostname: "",
  });
  const [emailConfigDraft, setEmailConfigDraft] = useState({ smtpHost: "", smtpPort: "", fromEmail: "", defaultTemplateId: "" });

  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [secIdentity, setSecIdentity] = useState(true);
  const [secContacts, setSecContacts] = useState(true);
  const [secLegal, setSecLegal] = useState(true);
  const [secBranding, setSecBranding] = useState(false);
  const [secMarketing, setSecMarketing] = useState(false);
  const [secEmail, setSecEmail] = useState(false);
  const [secTechnica, setSecTechnica] = useState(false);
  const [secPdf, setSecPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "impostazioni">("overview");
  const [secAccess, setSecAccess] = useState(true);
  const [projectAccessList, setProjectAccessList] = useState<ProjectAccessRow[]>([]);
  const [partnerWorkspaceId, setPartnerWorkspaceId] = useState("");
  const [partnerRole, setPartnerRole] = useState<"collaborator" | "viewer">("viewer");
  const [savingAccess, setSavingAccess] = useState(false);

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

  const wsId = workspaceId || "";
  const pid = projectId || "";

  const loadAll = useCallback(async () => {
    if (!pid || !wsId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, pol, branding, mkt, cfg, etList, pdfList, accessRes] = await Promise.all([
        followupApi.getProjectDetail(pid, wsId),
        followupApi.getProjectPolicies(pid, wsId).catch(() => null),
        followupApi.getProjectBranding(pid, wsId).catch(() => null),
        followupApi.getProjectMarketingSettings(pid, wsId).catch(() => null),
        followupApi.getProjectEmailConfig(pid, wsId).catch(() => null),
        followupApi.listProjectEmailTemplates(pid, wsId).catch(() => []),
        followupApi.listProjectPdfTemplates(pid, wsId).catch(() => []),
        followupApi.listProjectAccess(pid, wsId).catch(() => ({ data: [] })),
      ]);
      setProject(proj);
      setIdentityDraft({
        name: proj.name,
        displayName: proj.displayName,
        mode: proj.mode,
        city: proj.city ?? "",
        payoff: proj.payoff ?? "",
        contactEmail: proj.contactEmail ?? "",
        contactPhone: proj.contactPhone ?? "",
        projectUrl: proj.projectUrl ?? "",
        customDomain: proj.customDomain ?? "",
        defaultLang: proj.defaultLang ?? "it",
        hostKey: proj.hostKey ?? "",
        assetKey: proj.assetKey ?? "",
        feVendorKey: proj.feVendorKey ?? "",
        automaticQuoteEnabled: proj.automaticQuoteEnabled ?? false,
        accountManagerEnabled: proj.accountManagerEnabled ?? false,
        hasDAS: proj.hasDAS ?? false,
        broker: proj.broker ?? "",
        iban: proj.iban ?? "",
      });
      setPoliciesDraft({
        privacyPolicyUrl: pol?.privacyPolicyUrl ?? "",
        termsUrl: pol?.termsUrl ?? "",
        content: pol?.content ?? "",
        legalNotes: pol?.legalNotes ?? "",
      });
      setBrandingDraft({
        logoUrl: (branding as { logoUrl?: string })?.logoUrl ?? "",
        primaryColor: (branding as { primaryColor?: string })?.primaryColor ?? "",
        footerText: (branding as { footerText?: string })?.footerText ?? "",
      });
      setMarketingDraft({
        googleAdsCustomerId: mkt?.googleAdsCustomerId ?? "",
        googleAdsLoginCustomerId: mkt?.googleAdsLoginCustomerId ?? "",
        ga4PropertyId: mkt?.ga4PropertyId ?? "",
        metaAdAccountId: mkt?.metaAdAccountId ?? "",
        siteHostname: mkt?.siteHostname ?? "",
      });
      setEmailConfigDraft({
        smtpHost: (cfg as Record<string, unknown>)?.smtpHost as string ?? "",
        smtpPort: String((cfg as Record<string, unknown>)?.smtpPort ?? ""),
        fromEmail: (cfg as Record<string, unknown>)?.fromEmail as string ?? "",
        defaultTemplateId: (cfg as Record<string, unknown>)?.defaultTemplateId as string ?? "",
      });
      setEmailTemplates(Array.isArray(etList) ? etList : []);
      setPdfTemplates(Array.isArray(pdfList) ? pdfList : []);
      setProjectAccessList(accessRes?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [pid, wsId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  useEffect(() => {
    const openMarketingFromHash = (): void => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#project-marketing-bigdata") return;
      setSecMarketing(true);
      requestAnimationFrame(() => {
        document.getElementById("project-marketing-bigdata")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    openMarketingFromHash();
    window.addEventListener("hashchange", openMarketingFromHash);
    return () => window.removeEventListener("hashchange", openMarketingFromHash);
  }, [pid]);

  useEffect(() => {
    if (!secMarketing || !wsId) return;
    let cancelled = false;
    setMktPickersLoading(true);
    setMktGa4LoadError(null);
    setMktGa4LoadHint(null);
    setMktAdsLoadError(null);
    setMktAdsLoadHint(null);
    void Promise.all([
      followupApi
        .getMarketingGoogleAdsCustomers(wsId)
        .then((r) => ({ adsOk: true as const, customers: r.customers ?? [] }))
        .catch((err: unknown) => ({ adsOk: false as const, err })),
      followupApi
        .getMarketingGoogleGa4Properties(wsId)
        .then((r) => ({ ga4Ok: true as const, properties: r.properties ?? [] }))
        .catch((err: unknown) => ({ ga4Ok: false as const, err })),
      followupApi.getMarketingMetaAdAccounts(wsId).catch(() => ({ adAccounts: [] as { id: string; name?: string; accountId: string }[] })),
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
  }, [secMarketing, wsId, mktPickerRefresh]);

  const adsPickOptions = useMemo(
    () => mergeAdsCustomers(mktAdsCustomers, marketingDraft.googleAdsCustomerId),
    [mktAdsCustomers, marketingDraft.googleAdsCustomerId]
  );
  const ga4PickOptions = useMemo(
    () => mergeGa4Properties(mktGa4Props, marketingDraft.ga4PropertyId),
    [mktGa4Props, marketingDraft.ga4PropertyId]
  );
  const metaPickOptions = useMemo(
    () => mergeMetaAdAccounts(mktMetaAccounts, marketingDraft.metaAdAccountId),
    [mktMetaAccounts, marketingDraft.metaAdAccountId]
  );

  const handleSaveIdentity = async () => {
    if (!pid || !wsId) return;
    setSavingIdentity(true);
    try {
      await followupApi.updateProject(pid, wsId, {
        name: identityDraft.name,
        displayName: identityDraft.displayName,
        mode: identityDraft.mode,
        city: identityDraft.city,
        payoff: identityDraft.payoff,
        contactEmail: identityDraft.contactEmail,
        contactPhone: identityDraft.contactPhone,
        projectUrl: identityDraft.projectUrl,
        customDomain: identityDraft.customDomain,
        defaultLang: identityDraft.defaultLang,
        hostKey: identityDraft.hostKey,
        assetKey: identityDraft.assetKey,
        feVendorKey: identityDraft.feVendorKey,
        automaticQuoteEnabled: identityDraft.automaticQuoteEnabled,
        accountManagerEnabled: identityDraft.accountManagerEnabled,
        hasDAS: identityDraft.hasDAS,
        broker: identityDraft.broker ?? null,
        iban: identityDraft.iban,
      });
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleSavePolicies = async () => {
    if (!pid || !wsId) return;
    setSavingPolicies(true);
    try {
      await followupApi.putProjectPolicies(pid, wsId, {
        privacyPolicyUrl: policiesDraft.privacyPolicyUrl || undefined,
        termsUrl: policiesDraft.termsUrl || undefined,
        content: policiesDraft.content || undefined,
        legalNotes: policiesDraft.legalNotes || undefined,
      });
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingPolicies(false);
    }
  };

  const setBrand = (part: Partial<{ logoUrl: string; primaryColor: string; footerText: string }>) =>
    setBrandingDraft((prev) => ({ ...prev, ...part }));

  const handleSaveBranding = async () => {
    if (!pid || !wsId) return;
    setSavingBranding(true);
    try {
      await followupApi.putProjectBranding(pid, wsId, {
        logoUrl: brandingDraft.logoUrl || undefined,
        primaryColor: brandingDraft.primaryColor || undefined,
        footerText: brandingDraft.footerText || undefined,
      });
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveMarketing = async () => {
    if (!pid || !wsId) return;
    setSavingMarketing(true);
    try {
      await followupApi.putProjectMarketingSettings(pid, wsId, {
        googleAdsCustomerId: marketingDraft.googleAdsCustomerId || null,
        googleAdsLoginCustomerId: marketingDraft.googleAdsLoginCustomerId || null,
        ga4PropertyId: marketingDraft.ga4PropertyId || null,
        metaAdAccountId: marketingDraft.metaAdAccountId || null,
        siteHostname: marketingDraft.siteHostname || null,
      });
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio marketing");
    } finally {
      setSavingMarketing(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    if (!pid || !wsId) return;
    setSavingEmail(true);
    try {
      await followupApi.putProjectEmailConfig(pid, wsId, {
        smtpHost: emailConfigDraft.smtpHost || undefined,
        smtpPort: emailConfigDraft.smtpPort ? parseInt(emailConfigDraft.smtpPort, 10) : undefined,
        fromEmail: emailConfigDraft.fromEmail || undefined,
        defaultTemplateId: emailConfigDraft.defaultTemplateId || undefined,
      });
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingEmail(false);
    }
  };

  const goBack = () => navigate(wsId ? `/?section=projects` : "/?section=projects");

  const handleGrantProjectAccess = async () => {
    if (!pid || !partnerWorkspaceId.trim()) return;
    setSavingAccess(true);
    try {
      await followupApi.grantProjectAccess(pid, { workspaceId: partnerWorkspaceId.trim(), role: partnerRole }, wsId);
      setPartnerWorkspaceId("");
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore invito partner");
    } finally {
      setSavingAccess(false);
    }
  };

  const handleRevokeProjectAccess = async (workspaceIdToRevoke: string) => {
    if (!pid || !window.confirm("Rimuovere l'accesso di questo workspace al progetto?")) return;
    setSavingAccess(true);
    try {
      await followupApi.revokeProjectAccess(pid, workspaceIdToRevoke, wsId);
      void loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione accesso");
    } finally {
      setSavingAccess(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-app px-5 py-10 lg:px-20">
        <p className="text-muted-foreground">Caricamento…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-full bg-app px-5 py-10 lg:px-20">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? "Progetto non trovato"}
        </div>
        <Button variant="outline" className="mt-4" onClick={goBack}>
          Torna ai Progetti
        </Button>
      </div>
    );
  }

  const setID = (patch: Partial<typeof identityDraft>) => setIdentityDraft((p) => ({ ...p, ...patch }));
  const setPol = (patch: Partial<PoliciesDoc>) => setPoliciesDraft((p) => ({ ...p, ...patch }));

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">

        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <Button variant="ghost" size="sm" className="mb-3 gap-2 -ml-2" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
              Torna ai Progetti
            </Button>
            <h1 className="text-2xl font-semibold text-foreground">
              {project.displayName || project.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {project.mode === "rent" ? "Affitto" : "Vendita"}
              </span>
              <span className="text-sm text-muted-foreground font-mono text-xs">{project.id}</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "impostazioni")} className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="impostazioni" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Impostazioni
            </TabsTrigger>
          </TabsList>

          {activeTab === "overview" && (
            <ProjectOverviewTab
              projectId={pid}
              workspaceId={wsId}
              projectName={project.displayName || project.name}
              projectMode={project.mode}
              onRefresh={loadAll}
            />
          )}

          {activeTab === "impostazioni" && (
        <div className="max-w-2xl space-y-0">

          {/* ── Identità ─── */}
          <section>
            <SectionTitle
              label="Identità"
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              open={secIdentity}
              onToggle={() => setSecIdentity(!secIdentity)}
            />
            {secIdentity && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Nome *">
                    <Input value={identityDraft.name} onChange={(e) => setID({ name: e.target.value })} required />
                  </F>
                  <F label="Display name">
                    <Input value={identityDraft.displayName} onChange={(e) => setID({ displayName: e.target.value })} placeholder={identityDraft.name} />
                  </F>
                  <F label="Modalità *">
                    <Select value={identityDraft.mode} onValueChange={(v) => setID({ mode: v as "rent" | "sell" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sell">Vendita</SelectItem>
                        <SelectItem value="rent">Affitto</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Lingua default">
                    <Select value={identityDraft.defaultLang} onValueChange={(v) => setID({ defaultLang: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Città">
                    <Input value={identityDraft.city} onChange={(e) => setID({ city: e.target.value })} placeholder="Milano" />
                  </F>
                  <F label="Payoff">
                    <Input value={identityDraft.payoff} onChange={(e) => setID({ payoff: e.target.value })} placeholder="Slogan del progetto" />
                  </F>
                </div>
                <Button size="sm" onClick={handleSaveIdentity} disabled={savingIdentity} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingIdentity ? "Salvataggio…" : "Salva identità"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Chi ha accesso ─── */}
          <section>
            <SectionTitle
              label="Chi ha accesso"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              open={secAccess}
              onToggle={() => setSecAccess(!secAccess)}
            />
            {secAccess && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Workspace e ruoli con accesso al progetto. Owner = workspace proprietario.
                </p>
                {projectAccessList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun accesso oltre al proprietario.</p>
                ) : (
                  <ul className="rounded-md border border-border divide-y divide-border">
                    {projectAccessList.map((pa) => (
                      <li key={pa._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="font-mono text-muted-foreground truncate flex-1">{pa.workspaceId}</span>
                        <span className="capitalize shrink-0">{pa.role}</span>
                        {pa.role !== "owner" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevokeProjectAccess(pa.workspaceId)}
                            disabled={savingAccess}
                          >
                            Rimuovi
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <UserPlus className="h-3.5 w-3.5" />
                    Invita partner (workspace)
                  </span>
                  <Input
                    placeholder="ID workspace partner"
                    value={partnerWorkspaceId}
                    onChange={(e) => setPartnerWorkspaceId(e.target.value)}
                    className="h-9 max-w-[200px] font-mono text-sm"
                  />
                  <select
                    value={partnerRole}
                    onChange={(e) => setPartnerRole(e.target.value as "collaborator" | "viewer")}
                    className="h-9 rounded border border-border bg-background px-2 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="collaborator">Collaborator</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={handleGrantProjectAccess}
                    disabled={savingAccess || !partnerWorkspaceId.trim()}
                  >
                    {savingAccess ? "Invito…" : "Aggiungi"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* ── Contatti ─── */}
          <section>
            <SectionTitle
              label="Contatti e URL"
              icon={<Globe className="h-4 w-4 text-muted-foreground" />}
              open={secContacts}
              onToggle={() => setSecContacts(!secContacts)}
            />
            {secContacts && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Email contatto">
                    <Input type="email" value={identityDraft.contactEmail} onChange={(e) => setID({ contactEmail: e.target.value })} placeholder="info@progetto.it" />
                  </F>
                  <F label="Telefono contatto">
                    <Input value={identityDraft.contactPhone} onChange={(e) => setID({ contactPhone: e.target.value })} placeholder="+39 02..." />
                  </F>
                  <F label="URL sito progetto">
                    <Input value={identityDraft.projectUrl} onChange={(e) => setID({ projectUrl: e.target.value })} placeholder="https://progetto.it" />
                  </F>
                  <F label="Dominio custom">
                    <Input value={identityDraft.customDomain} onChange={(e) => setID({ customDomain: e.target.value })} placeholder="app.progetto.it" />
                  </F>
                </div>
                <Button size="sm" onClick={handleSaveIdentity} disabled={savingIdentity} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingIdentity ? "Salvataggio…" : "Salva contatti"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Note legali e privacy ─── */}
          <section>
            <SectionTitle
              label="Note legali e privacy"
              icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
              open={secLegal}
              onToggle={() => setSecLegal(!secLegal)}
            />
            {secLegal && (
              <div className="mt-4 space-y-4">
                <F label="Note legali" hint="Testo delle note legali mostrate ai clienti (disclaimer, limitazioni di responsabilità, ecc.).">
                  <Textarea
                    value={policiesDraft.legalNotes}
                    onChange={(e) => setPol({ legalNotes: e.target.value })}
                    placeholder="Tutti i dati pubblicati hanno carattere indicativo e non costituiscono offerta contrattuale…"
                    rows={5}
                    className="w-full"
                  />
                </F>
                <F label="URL Privacy Policy">
                  <Input
                    value={policiesDraft.privacyPolicyUrl}
                    onChange={(e) => setPol({ privacyPolicyUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </F>
                <F label="URL Termini e condizioni">
                  <Input
                    value={policiesDraft.termsUrl}
                    onChange={(e) => setPol({ termsUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </F>
                <F label="Contenuto policy inline (opzionale)" hint="Testo alternativo se non si usa un URL esterno.">
                  <Textarea
                    value={policiesDraft.content}
                    onChange={(e) => setPol({ content: e.target.value })}
                    placeholder="Testo policy completo…"
                    rows={3}
                    className="w-full"
                  />
                </F>
                <Button size="sm" onClick={handleSavePolicies} disabled={savingPolicies} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingPolicies ? "Salvataggio…" : "Salva note e policy"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Branding (email/comunicazioni) ─── */}
          <section>
            <SectionTitle
              label="Branding (email e comunicazioni)"
              icon={<Palette className="h-4 w-4 text-muted-foreground" />}
              open={secBranding}
              onToggle={() => setSecBranding(!secBranding)}
            />
            {secBranding && (
              <div className="mt-4 space-y-4">
                <F label="URL logo" hint="Logo mostrato nell'intestazione delle email (URL pubblico).">
                  <Input
                    value={brandingDraft.logoUrl}
                    onChange={(e) => setBrand({ logoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </F>
                <F label="Colore primario" hint="Es. #2563eb per bordo e accenti nelle email.">
                  <Input
                    value={brandingDraft.primaryColor}
                    onChange={(e) => setBrand({ primaryColor: e.target.value })}
                    placeholder="#2563eb"
                  />
                </F>
                <F label="Testo footer" hint="Testo in fondo alle email (es. disclaimer o link).">
                  <Textarea
                    value={brandingDraft.footerText}
                    onChange={(e) => setBrand({ footerText: e.target.value })}
                    placeholder="© Progetto. Tutti i diritti riservati."
                    rows={2}
                    className="w-full"
                  />
                </F>
                <Button size="sm" onClick={handleSaveBranding} disabled={savingBranding} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingBranding ? "Salvataggio…" : "Salva branding"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Marketing / Big Data (ID non sensibili) ─── */}
          <section id="project-marketing-bigdata">
            <SectionTitle
              label="Marketing / Big Data"
              icon={<BarChart2 className="h-4 w-4 text-muted-foreground" />}
              open={secMarketing}
              onToggle={() => setSecMarketing(!secMarketing)}
            />
            {secMarketing && (
              <div className="mt-4 space-y-5">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">Account marketing per questo progetto</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Tutto dentro Followup:</span> in{" "}
                      <span className="font-medium text-foreground">Integrazioni → Big Data</span> collega{" "}
                      <span className="font-medium text-foreground">solo i provider che ti servono</span> (Google per Ads e GA4, Meta
                      per le ads Meta — non sono obbligatori entrambi). Poi <span className="font-medium text-foreground">qui</span>{" "}
                      scegli gli account per <span className="font-medium text-foreground">questo</span> progetto.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={mktPickersLoading}
                      onClick={() => setMktPickerRefresh((n) => n + 1)}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", mktPickersLoading && "animate-spin")} />
                      Ricarica elenchi
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => navigate(`/?section=integrations&tab=connettori`)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Integrazioni Big Data
                    </Button>
                  </div>
                </div>

                {mktPickersLoading ? (
                  <p className="text-xs text-muted-foreground">Lettura account dai collegamenti del workspace…</p>
                ) : adsPickOptions.length === 0 && ga4PickOptions.length === 0 && metaPickOptions.length === 0 ? (
                  mktGa4LoadError || mktAdsLoadError ? null : (
                    <Alert
                      variant="info"
                      title="Nessun elenco ancora disponibile"
                      action={
                        <Button type="button" size="sm" variant="default" onClick={() => navigate(`/?section=integrations&tab=connettori`)}>
                          Apri Integrazioni Big Data
                        </Button>
                      }
                    >
                      Collega <strong>solo</strong> ciò che ti serve: <strong>Collega Google</strong> se usi Ads o GA4;{" "}
                      <strong>Collega Meta</strong> se usi le ads Meta. Non devi configurarli tutti. Dopo OAuth torna qui e premi{" "}
                      <strong>Ricarica elenchi</strong>. Se un account non compare, l&apos;utente del login deve avere accesso a
                      quell&apos;account lato Google o Meta.
                    </Alert>
                  )
                ) : (
                  <Alert variant="success" title="Elenchi pronti per i canali collegati">
                    Scegli sotto per ogni canale che usi. I valori già salvati sul progetto restano in elenco anche se l&apos;API non
                    li restituisce più.
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-foreground">Google Ads</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Account pubblicitario collegato al workspace dopo il login in Integrazioni. Scegli quello da usare per questo
                        progetto Followup.
                      </p>
                    </div>
                    <MarketingAdsPicker
                      className="mt-2"
                      options={adsPickOptions}
                      value={marketingDraft.googleAdsCustomerId}
                      onChange={(googleAdsCustomerId) =>
                        setMarketingDraft((p) => ({ ...p, googleAdsCustomerId }))
                      }
                      loadError={mktAdsLoadError}
                      loadErrorHint={mktAdsLoadHint}
                      emptyHint="Google è collegato ma non risultano customer accessibili da API. Verifica in ads.google.com che l’utente dell’OAuth abbia accesso a un account pubblicitario; se usi un MCC, assicurati che sia collegato. Poi premi Ricarica elenchi."
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-foreground">Google Analytics 4</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Proprietà GA4 visibili con le stesse credenziali Google del workspace. Scegli la proprietà per questo
                        progetto Followup.
                      </p>
                    </div>
                    <MarketingGa4TwoPanePicker
                      className="mt-2"
                      properties={ga4PickOptions}
                      value={marketingDraft.ga4PropertyId}
                      onChange={(ga4PropertyId) => setMarketingDraft((p) => ({ ...p, ga4PropertyId }))}
                      loadError={mktGa4LoadError}
                      loadErrorHint={mktGa4LoadHint}
                      emptyHintAccounts="Google risulta collegato ma non risultano proprietà GA4 da elencare. Verifica su analytics.google.com che l’utente usato in OAuth abbia accesso ad almeno una proprietà GA4, poi premi Ricarica elenchi."
                      emptyHintProperties="Se l’accesso GA4 è corretto, controlla nel progetto Google Cloud dell’OAuth marketing che sia abilitata l’API «Google Analytics Admin». In caso di dubbio, disconnetti e ricollega Google in Integrazioni."
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-foreground">Meta (Facebook / Instagram Ads)</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Account pubblicitario dopo il login Meta in Integrazioni. Scegli quello per questo progetto Followup.
                      </p>
                    </div>
                    <MarketingMetaPicker
                      className="mt-2"
                      options={metaPickOptions}
                      value={marketingDraft.metaAdAccountId}
                      onChange={(metaAdAccountId) => setMarketingDraft((p) => ({ ...p, metaAdAccountId }))}
                      emptyHint="Nessun account Meta dall'API. Collega Meta in Integrazioni e ricarica."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={() => void handleSaveMarketing()} disabled={savingMarketing} className="gap-2">
                    <Save className="h-3.5 w-3.5" />
                    {savingMarketing ? "Salvataggio…" : "Applica a questo progetto"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Salva le scelte; OAuth e token restano in Integrazioni.
                  </span>
                </div>

                <details className="rounded-lg border border-border bg-muted/15 p-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-foreground">
                    Note per chi configura le API (Google Cloud, developer token, app Meta…)
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-border pt-3 leading-relaxed">
                    <p>
                      <span className="font-medium text-foreground">Qui non si creano app né utenti.</span> Si collegano solo account
                      già esistenti. Progetto Google Cloud, OAuth, developer token Ads e app Meta si gestiscono in{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => navigate(`/?section=integrations&tab=connettori`)}
                      >
                        Integrazioni → Big Data
                      </button>
                      .
                    </p>
                    <p>
                      OAuth guidato è in Integrazioni; per GA4 senza login utente resta il service account in Avanzato. Senza
                      credenziali workspace le API non leggono dati anche se gli ID qui sono compilati.
                    </p>
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* ── Tecnica ─── */}
          <section>
            <SectionTitle
              label="Configurazione tecnica"
              icon={<KeyRound className="h-4 w-4 text-muted-foreground" />}
              open={secTechnica}
              onToggle={() => setSecTechnica(!secTechnica)}
            />
            {secTechnica && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Host key" hint="Chiave host per routing progetto.">
                    <Input value={identityDraft.hostKey} onChange={(e) => setID({ hostKey: e.target.value })} className="font-mono text-sm" />
                  </F>
                  <F label="Asset key" hint="Chiave asset per media/planimetrie.">
                    <Input value={identityDraft.assetKey} onChange={(e) => setID({ assetKey: e.target.value })} className="font-mono text-sm" />
                  </F>
                  <F label="Frontend vendor key" hint="Chiave per l'interfaccia vendor.">
                    <Input value={identityDraft.feVendorKey} onChange={(e) => setID({ feVendorKey: e.target.value })} className="font-mono text-sm" />
                  </F>
                  <F label="Broker" hint="Broker associato al progetto.">
                    <Input value={identityDraft.broker ?? ""} onChange={(e) => setID({ broker: e.target.value })} />
                  </F>
                  <F label="IBAN" hint="IBAN per pagamenti/preventivi.">
                    <Input value={identityDraft.iban} onChange={(e) => setID({ iban: e.target.value })} className="font-mono text-sm" />
                  </F>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ToggleLeft className="h-3.5 w-3.5" />
                    Feature attive
                  </p>
                  {[
                    { key: "automaticQuoteEnabled" as const, label: "Preventivo automatico", hint: "Abilita calcolo automatico del preventivo" },
                    { key: "accountManagerEnabled" as const, label: "Account manager", hint: "Abilita ruolo account manager sul progetto" },
                    { key: "hasDAS" as const, label: "DAS (Dichiarazione Attività Sostanziali)", hint: "Il progetto richiede la documentazione DAS" },
                  ].map(({ key, label, hint }) => (
                    <div key={key} className="flex items-start gap-3">
                      <Checkbox
                        checked={identityDraft[key]}
                        onCheckedChange={(v) => setID({ [key]: Boolean(v) })}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={handleSaveIdentity} disabled={savingIdentity} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingIdentity ? "Salvataggio…" : "Salva configurazione tecnica"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Email ─── */}
          <section>
            <SectionTitle
              label="Email e template"
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
              open={secEmail}
              onToggle={() => setSecEmail(!secEmail)}
            />
            {secEmail && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="SMTP Host">
                    <Input value={emailConfigDraft.smtpHost} onChange={(e) => setEmailConfigDraft((p) => ({ ...p, smtpHost: e.target.value }))} placeholder="smtp.example.com" />
                  </F>
                  <F label="SMTP Port">
                    <Input type="number" value={emailConfigDraft.smtpPort} onChange={(e) => setEmailConfigDraft((p) => ({ ...p, smtpPort: e.target.value }))} placeholder="587" />
                  </F>
                  <F label="From Email">
                    <Input type="email" value={emailConfigDraft.fromEmail} onChange={(e) => setEmailConfigDraft((p) => ({ ...p, fromEmail: e.target.value }))} placeholder="noreply@example.com" />
                  </F>
                  <F label="Template default">
                    <Input value={emailConfigDraft.defaultTemplateId} onChange={(e) => setEmailConfigDraft((p) => ({ ...p, defaultTemplateId: e.target.value }))} placeholder="ID template" />
                  </F>
                </div>
                <Button size="sm" onClick={handleSaveEmailConfig} disabled={savingEmail} className="gap-2">
                  <Save className="h-3.5 w-3.5" />
                  {savingEmail ? "Salvataggio…" : "Salva config email"}
                </Button>
                {emailTemplates.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Template email ({emailTemplates.length})</p>
                    <ul className="space-y-1">
                      {emailTemplates.map((t) => (
                        <li key={t._id} className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.name} — {t.subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── PDF ─── */}
          <section>
            <SectionTitle
              label="Template PDF"
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              open={secPdf}
              onToggle={() => setSecPdf(!secPdf)}
            />
            {secPdf && (
              <div className="mt-4">
                {pdfTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun template PDF.</p>
                ) : (
                  <ul className="space-y-1">
                    {pdfTemplates.map((t) => (
                      <li key={t._id} className="flex items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.name} ({t.templateKey})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ── Altri strumenti ─── */}
          <section className="border-t border-border pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Altri strumenti</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate("/?section=workspaces")} className="gap-2">
                <Link2 className="h-3.5 w-3.5" />
                Campi custom (Additional infos)
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/?section=templateConfig")} className="gap-2">
                <Settings className="h-3.5 w-3.5" />
                Template configurazione HC
              </Button>
            </div>
          </section>
        </div>
          )}
        </Tabs>
      </div>
    </div>
  );
};
