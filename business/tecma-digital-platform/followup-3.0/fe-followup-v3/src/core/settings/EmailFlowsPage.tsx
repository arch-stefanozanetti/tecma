/**
 * Admin: template email transazionali (invito, reset, verifica).
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { PageSimple } from "../shared/PageSimple";
import {
  EmailFlowsBlockEditor,
  defaultEmailLayout,
  type EmailLayoutState
} from "./EmailFlowsBlockEditor";

export type EmailFlowRow = {
  flowKey: string;
  label: string;
  description: string;
  placeholders: string[];
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  hasCustomTemplate: boolean;
  editorMode: "html" | "blocks";
  layout: EmailLayoutState | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const EmailFlowsPage = () => {
  const { isAdmin } = useWorkspace();
  const { toast, toastError } = useToast();
  const [rows, setRows] = useState<EmailFlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [editTab, setEditTab] = useState<"blocks" | "html">("html");
  const [layout, setLayout] = useState<EmailLayoutState>(() => defaultEmailLayout("user_invite"));

  const selected = rows.find((r) => r.flowKey === selectedKey);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    followupApi
      .listEmailFlows()
      .then((list) => {
        const arr = list as EmailFlowRow[];
        setRows(arr);
        setSelectedKey((k) => k ?? (arr[0]?.flowKey ?? null));
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Errore";
        setError(msg);
        if (String(msg).includes("403") || String(msg).toLowerCase().includes("forbidden")) {
          setError("Non hai permesso (richiesto amministratore).");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedKey) return;
    const r = rows.find((x) => x.flowKey === selectedKey);
    if (r) {
      setSubject(r.subject);
      setBodyHtml(r.bodyHtml);
      setEnabled(r.enabled);
      setEditTab(r.editorMode === "blocks" ? "blocks" : "html");
      setLayout(
        r.layout && r.editorMode === "blocks"
          ? {
              logoUrl: r.layout.logoUrl,
              primaryColor: r.layout.primaryColor,
              blocks: r.layout.blocks as EmailLayoutState["blocks"]
            }
          : defaultEmailLayout(r.flowKey)
      );
    }
  }, [selectedKey, rows]);

  const loadSuggested = async () => {
    if (!selectedKey) return;
    if (editTab === "blocks") {
      toast({
        title: "Passa a «HTML avanzato»",
        description: "Il testo suggerito si applica solo alla modalità HTML."
      });
      return;
    }
    try {
      const s = await followupApi.getEmailFlowSuggested(selectedKey);
      setSubject(s.subject);
      setBodyHtml(s.bodyHtml);
      toast({ title: "Template suggerito caricato" });
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore");
    }
  };

  const save = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const updated = editTab === "blocks"
        ? await followupApi.updateEmailFlow(selectedKey, {
            editorMode: "blocks",
            enabled,
            subject,
            layout: {
              logoUrl: layout.logoUrl.trim(),
              primaryColor: /^#[0-9A-Fa-f]{6}$/.test(layout.primaryColor)
                ? layout.primaryColor
                : "#1a1a2e",
              blocks: layout.blocks
            }
          })
        : await followupApi.updateEmailFlow(selectedKey, {
            editorMode: "html",
            enabled,
            subject,
            bodyHtml
          });
      setRows((prev) =>
        prev.map((r) =>
          r.flowKey === selectedKey
            ? {
                ...r,
                ...updated,
                editorMode: updated.editorMode,
                layout: (updated.layout as EmailLayoutState | null) ?? null
              }
            : r
        )
      );
      toast({ title: "Salvato" });
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!selectedKey) return;
    try {
      const res =
        editTab === "blocks"
          ? await followupApi.previewEmailFlow(selectedKey, {
              subject,
              layout: {
                logoUrl: layout.logoUrl.trim(),
                primaryColor: /^#[0-9A-Fa-f]{6}$/.test(layout.primaryColor)
                  ? layout.primaryColor
                  : "#1a1a2e",
                blocks: layout.blocks
              },
              sampleVars: {}
            })
          : await followupApi.previewEmailFlow(selectedKey, {
              subject,
              bodyHtml,
              sampleVars: {}
            });
      setPreviewSubject(res.subject);
      setPreviewHtml(res.html);
      setPreviewOpen(true);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Anteprima fallita");
    }
  };

  if (!isAdmin) {
    return (
      <PageSimple title="Email" description="Solo amministratori.">
        <p className="text-sm text-muted-foreground">Accesso negato.</p>
      </PageSimple>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <PageSimple title="Email transazionali" description="Caricamento…">
        <p className="text-sm text-muted-foreground">Attendere…</p>
      </PageSimple>
    );
  }

  if (error && rows.length === 0) {
    return (
      <PageSimple title="Email transazionali" description="Errore">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Riprova
        </Button>
      </PageSimple>
    );
  }

  const ph = selected?.placeholders?.length
    ? selected.placeholders.map((p) => `{{${p}}}`).join(", ")
    : "";

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-xl font-semibold text-foreground">Email transazionali</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Editor a blocchi: HTML generato e sanitizzato lato server. Logo/immagini: URL https in whitelist (
          <code className="rounded bg-muted px-1">EMAIL_ASSET_URL_HOSTS</code>) o upload S3 (
          <code className="rounded bg-muted px-1">EMAIL_FLOW_S3_BUCKET</code>
          ). Placeholder ammessi: <code className="rounded bg-muted px-1">{ph}</code>
        </p>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className="w-full max-w-xs space-y-1 rounded-ui border border-border bg-background p-2 shadow-sm">
            {rows.map((r) => (
              <button
                key={r.flowKey}
                type="button"
                onClick={() => setSelectedKey(r.flowKey)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedKey === r.flowKey ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                }`}
              >
                {r.label}
                {r.enabled ? <span className="ml-2 text-xs text-muted-foreground">(ON)</span> : null}
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-4 rounded-ui border border-border bg-background p-6 shadow-panel">
            {selected ? (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ef-enabled"
                    checked={enabled}
                    onCheckedChange={(c) => setEnabled(c === true)}
                  />
                  <label htmlFor="ef-enabled" className="cursor-pointer text-sm font-medium">
                    Usa template personalizzato
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">{selected.description}</p>

                <div className="flex gap-2 border-b border-border pb-2">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      editTab === "blocks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setEditTab("blocks")}
                  >
                    Editor a blocchi
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      editTab === "html" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setEditTab("html")}
                  >
                    HTML avanzato
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium">Oggetto</span>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="max-w-xl" />
                </div>

                {editTab === "blocks" ? (
                  <EmailFlowsBlockEditor
                    flowKey={selected.flowKey}
                    placeholders={selected.placeholders}
                    layout={layout}
                    onChange={setLayout}
                  />
                ) : (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Corpo HTML</span>
                    <Textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      className="min-h-[280px] font-mono text-xs"
                      spellCheck={false}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={loadSuggested}>
                    Carica testo suggerito
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={runPreview}>
                    Anteprima
                  </Button>
                  <Button type="button" onClick={save} disabled={saving}>
                    {saving ? "Salvataggio…" : "Salva"}
                  </Button>
                </div>
                {selected.updatedAt || selected.updatedBy ? (
                  <p className="text-xs text-muted-foreground">
                    Ultimo aggiornamento: {selected.updatedAt ?? "—"}
                    {selected.updatedBy ? ` · ${selected.updatedBy}` : ""}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {previewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-ui border border-border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="font-medium">Anteprima</span>
                <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
                  Chiudi
                </Button>
              </div>
              <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
                <strong>Oggetto:</strong> {previewSubject}
              </p>
              <iframe
                title="Anteprima email"
                sandbox=""
                className="min-h-[360px] w-full flex-1 border-0 bg-white"
                srcDoc={previewHtml}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
