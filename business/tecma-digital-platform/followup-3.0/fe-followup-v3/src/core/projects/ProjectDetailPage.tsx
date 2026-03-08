/**
 * Pagina dettaglio e configurazione progetto.
 * Sezioni: Identità, Contatti, Tecnica, Note legali e privacy, Email, PDF templates, Altri strumenti.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";

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
  const workspaceId = searchParams.get("workspaceId") ?? scopeWorkspaceId ?? "";

  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ _id: string; name: string; subject: string }>>([]);
  const [pdfTemplates, setPdfTemplates] = useState<Array<{ _id: string; name: string; templateKey: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [identityDraft, setIdentityDraft] = useState(emptyProject());
  const [policiesDraft, setPoliciesDraft] = useState(emptyPolicies());
  const [emailConfigDraft, setEmailConfigDraft] = useState({ smtpHost: "", smtpPort: "", fromEmail: "", defaultTemplateId: "" });

  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [secIdentity, setSecIdentity] = useState(true);
  const [secContacts, setSecContacts] = useState(true);
  const [secLegal, setSecLegal] = useState(true);
  const [secEmail, setSecEmail] = useState(false);
  const [secTechnica, setSecTechnica] = useState(false);
  const [secPdf, setSecPdf] = useState(false);

  const wsId = workspaceId || "";
  const pid = projectId || "";

  const loadAll = useCallback(async () => {
    if (!pid || !wsId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, pol, cfg, etList, pdfList] = await Promise.all([
        followupApi.getProjectDetail(pid, wsId),
        followupApi.getProjectPolicies(pid, wsId).catch(() => null),
        followupApi.getProjectEmailConfig(pid, wsId).catch(() => null),
        followupApi.listProjectEmailTemplates(pid, wsId).catch(() => []),
        followupApi.listProjectPdfTemplates(pid, wsId).catch(() => []),
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
      setEmailConfigDraft({
        smtpHost: (cfg as Record<string, unknown>)?.smtpHost as string ?? "",
        smtpPort: String((cfg as Record<string, unknown>)?.smtpPort ?? ""),
        fromEmail: (cfg as Record<string, unknown>)?.fromEmail as string ?? "",
        defaultTemplateId: (cfg as Record<string, unknown>)?.defaultTemplateId as string ?? "",
      });
      setEmailTemplates(Array.isArray(etList) ? etList : []);
      setPdfTemplates(Array.isArray(pdfList) ? pdfList : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [pid, wsId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

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
      window.alert(e instanceof Error ? e.message : "Errore salvataggio");
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
      window.alert(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingPolicies(false);
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
      window.alert(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingEmail(false);
    }
  };

  const goBack = () => navigate(wsId ? `/?section=projects` : "/?section=projects");

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

        <div className="mt-6 max-w-2xl space-y-0">

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
      </div>
    </div>
  );
};
