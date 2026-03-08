/**
 * Pagina dettaglio progetto: identità, privacy, email, PDF, campi custom, template config.
 * Layout con sezioni collassabili (stile WorkspacesPage).
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { ChevronDown, Mail, FileText, Settings, Link2 } from "lucide-react";

const SectionTitle = ({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="flex w-full items-center justify-between border-b border-border pb-2 pt-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
    onClick={onToggle}
  >
    {label}
    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
  </button>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <p className="text-sm text-foreground">{value || "—"}</p>
  </div>
);

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaceId: scopeWorkspaceId } = useWorkspace();
  const workspaceId = searchParams.get("workspaceId") ?? scopeWorkspaceId ?? "";

  const [project, setProject] = useState<{ id: string; name: string; displayName: string; mode: string; city?: string; payoff?: string } | null>(null);
  const [policies, setPolicies] = useState<{ privacyPolicyUrl?: string; termsUrl?: string; content?: string; updatedAt: string } | null>(null);
  const [emailConfig, setEmailConfig] = useState<{ smtpHost?: string; smtpPort?: number; fromEmail?: string; defaultTemplateId?: string } | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ _id: string; name: string; subject: string }>>([]);
  const [pdfTemplates, setPdfTemplates] = useState<Array<{ _id: string; name: string; templateKey: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [secIdentity, setSecIdentity] = useState(true);
  const [secPolicies, setSecPolicies] = useState(true);
  const [secEmail, setSecEmail] = useState(true);
  const [secPdf, setSecPdf] = useState(false);

  const [policiesDraft, setPoliciesDraft] = useState({ privacyPolicyUrl: "", termsUrl: "", content: "" });
  const [emailConfigDraft, setEmailConfigDraft] = useState({ smtpHost: "", smtpPort: "", fromEmail: "", defaultTemplateId: "" });

  const wsId = workspaceId || "";
  const pid = projectId || "";

  const loadAll = useCallback(async () => {
    if (!pid || !wsId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, pol, cfg, etList, pdfList] = await Promise.all([
        followupApi.getProjectDetail(pid, wsId),
        followupApi.getProjectPolicies(pid, wsId).catch(() => ({ projectId: pid, updatedAt: "" })),
        followupApi.getProjectEmailConfig(pid, wsId).catch(() => ({ projectId: pid, updatedAt: "" })),
        followupApi.listProjectEmailTemplates(pid, wsId).catch(() => []),
        followupApi.listProjectPdfTemplates(pid, wsId).catch(() => []),
      ]);
      setProject(proj);
      setPolicies(pol);
      setEmailConfig(cfg);
      setPoliciesDraft({
        privacyPolicyUrl: pol.privacyPolicyUrl ?? "",
        termsUrl: pol.termsUrl ?? "",
        content: pol.content ?? "",
      });
      setEmailConfigDraft({
        smtpHost: cfg.smtpHost ?? "",
        smtpPort: cfg.smtpPort?.toString() ?? "",
        fromEmail: cfg.fromEmail ?? "",
        defaultTemplateId: cfg.defaultTemplateId ?? "",
      });
      setEmailTemplates(Array.isArray(etList) ? etList : []);
      setPdfTemplates(Array.isArray(pdfList) ? pdfList : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [pid, wsId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSavePolicies = async () => {
    if (!pid || !wsId) return;
    setSaving(true);
    try {
      await followupApi.putProjectPolicies(pid, wsId, {
        privacyPolicyUrl: policiesDraft.privacyPolicyUrl || undefined,
        termsUrl: policiesDraft.termsUrl || undefined,
        content: policiesDraft.content || undefined,
      });
      void loadAll();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    if (!pid || !wsId) return;
    setSaving(true);
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
      setSaving(false);
    }
  };

  const goToSection = (section: string) => {
    navigate(`/?section=${section}`);
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
        <Button variant="outline" className="mt-4" onClick={() => navigate("/?section=workspaces")}>
          Torna ai Workspaces
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{project.displayName || project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configurazione progetto · {project.mode === "rent" ? "Affitto" : "Vendita"}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/?section=workspaces")}>
            Torna ai Workspaces
          </Button>
        </div>

        <div className="mt-8 space-y-6 max-w-2xl">
          {/* Identità */}
          <section>
            <SectionTitle label="Identità" open={secIdentity} onToggle={() => setSecIdentity(!secIdentity)} />
            {secIdentity && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Nome" value={project.name} />
                <Field label="Display name" value={project.displayName} />
                <Field label="Modalità" value={project.mode === "rent" ? "Affitto" : "Vendita"} />
                {project.city && <Field label="Città" value={project.city} />}
                {project.payoff && <Field label="Payoff" value={project.payoff} />}
              </div>
            )}
          </section>

          {/* Privacy e termini */}
          <section>
            <SectionTitle label="Privacy e termini" open={secPolicies} onToggle={() => setSecPolicies(!secPolicies)} />
            {secPolicies && (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">URL Privacy Policy</label>
                  <Input
                    value={policiesDraft.privacyPolicyUrl}
                    onChange={(e) => setPoliciesDraft((p) => ({ ...p, privacyPolicyUrl: e.target.value }))}
                    placeholder="https://..."
                    className="max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">URL Termini</label>
                  <Input
                    value={policiesDraft.termsUrl}
                    onChange={(e) => setPoliciesDraft((p) => ({ ...p, termsUrl: e.target.value }))}
                    placeholder="https://..."
                    className="max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Contenuto (opzionale)</label>
                  <textarea
                    value={policiesDraft.content}
                    onChange={(e) => setPoliciesDraft((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Testo policy inline..."
                    rows={4}
                    className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button onClick={handleSavePolicies} disabled={saving}>
                  {saving ? "Salvataggio…" : "Salva"}
                </Button>
              </div>
            )}
          </section>

          {/* Email */}
          <section>
            <SectionTitle label="Email" open={secEmail} onToggle={() => setSecEmail(!secEmail)} />
            {secEmail && (
              <div className="mt-3 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">SMTP Host</label>
                    <Input
                      value={emailConfigDraft.smtpHost}
                      onChange={(e) => setEmailConfigDraft((p) => ({ ...p, smtpHost: e.target.value }))}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">SMTP Port</label>
                    <Input
                      type="number"
                      value={emailConfigDraft.smtpPort}
                      onChange={(e) => setEmailConfigDraft((p) => ({ ...p, smtpPort: e.target.value }))}
                      placeholder="587"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From Email</label>
                    <Input
                      type="email"
                      value={emailConfigDraft.fromEmail}
                      onChange={(e) => setEmailConfigDraft((p) => ({ ...p, fromEmail: e.target.value }))}
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Template default</label>
                    <Input
                      value={emailConfigDraft.defaultTemplateId}
                      onChange={(e) => setEmailConfigDraft((p) => ({ ...p, defaultTemplateId: e.target.value }))}
                      placeholder="ID template"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveEmailConfig} disabled={saving}>
                  {saving ? "Salvataggio…" : "Salva config email"}
                </Button>
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Template email ({emailTemplates.length})</p>
                  {emailTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nessun template. Usa l&apos;API per crearne.</p>
                  ) : (
                    <ul className="space-y-1">
                      {emailTemplates.map((t) => (
                        <li key={t._id} className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.name} — {t.subject}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* PDF */}
          <section>
            <SectionTitle label="Template PDF" open={secPdf} onToggle={() => setSecPdf(!secPdf)} />
            {secPdf && (
              <div className="mt-3">
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

          {/* Campi custom / Template config — link */}
          <section className="border-t border-border pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Altri strumenti</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToSection("workspaces")}
                className="gap-2"
              >
                <Link2 className="h-3.5 w-3.5" />
                Campi custom (Additional infos)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToSection("templateConfig")}
                className="gap-2"
              >
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
