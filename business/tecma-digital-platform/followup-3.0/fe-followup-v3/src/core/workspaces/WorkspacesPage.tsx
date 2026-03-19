/**
 * Pagina gestione Workspaces (solo admin).
 * CRUD workspace + associazione progetti. Usa Drawer DS per crea/modifica.
 */
import { useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { WorkspaceRow, WorkspaceProjectRow, ProjectAccessProject, WorkspaceUserRow, WorkspaceUserRole, AccessScope, WorkspaceAiConfig } from "../../types/domain";
import { useWorkspaceRoles } from "../../hooks/useWorkspaceRoles";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Link2, Unlink, ChevronDown, Settings, Users, UserPlus, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { FileUpload } from "../../components/ui/file-upload";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const Field = ({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-foreground">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

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
    className="flex w-full items-center justify-between border-b border-border pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
    onClick={onToggle}
  >
    {label}
    <ChevronDown
      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
    />
  </button>
);

/* ─── tipi form progetto ───────────────────────────────────────────────────── */

interface ProjectForm {
  name: string;
  displayName: string;
  mode: "rent" | "sell";
  city: string;
  payoff: string;
  contactEmail: string;
  contactPhone: string;
  projectUrl: string;
  customDomain: string;
  defaultLang: string;
  hostKey: string;
  assetKey: string;
  feVendorKey: string;
  automaticQuoteEnabled: boolean;
  accountManagerEnabled: boolean;
  hasDAS: boolean;
  broker: string;
  iban: string;
}

const emptyProjectForm = (): ProjectForm => ({
  name: "",
  displayName: "",
  mode: "sell",
  city: "",
  payoff: "",
  contactEmail: "",
  contactPhone: "",
  projectUrl: "",
  customDomain: "",
  defaultLang: "it",
  hostKey: "",
  assetKey: "",
  feVendorKey: "",
  automaticQuoteEnabled: false,
  accountManagerEnabled: false,
  hasDAS: false,
  broker: "",
  iban: "",
});

/* ─── componente ───────────────────────────────────────────────────────────── */

export const WorkspacesPage = () => {
  const navigate = useNavigate();
  const { email } = useWorkspace();
  const { toastError, toastSuccess } = useToast();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedWs, setSelectedWs] = useState<WorkspaceRow | null>(null);
  const [projects, setProjects] = useState<WorkspaceProjectRow[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectAccessProject[]>([]);

  /* drawer workspace */
  const [wsDrawerOpen, setWsDrawerOpen] = useState(false);
  const [wsDrawerMode, setWsDrawerMode] = useState<"create" | "edit">("create");
  const [wsFormName, setWsFormName] = useState("");
  const [workspaceBranding, setWorkspaceBranding] = useState<{
    logoDownloadUrl?: string;
    emailHeaderDownloadUrl?: string;
    logoAssetId?: string;
    emailHeaderAssetId?: string;
    updatedAt: string;
  } | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [emailHeaderUploading, setEmailHeaderUploading] = useState(false);
  const [secBranding, setSecBranding] = useState(true);

  /* Provider AI (drawer edit) */
  const [workspaceAiConfig, setWorkspaceAiConfig] = useState<WorkspaceAiConfig | null>(null);
  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [secAi, setSecAi] = useState(true);
  const [aiFormProvider, setAiFormProvider] = useState<string>("claude");
  const [aiFormApiKey, setAiFormApiKey] = useState("");
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiFormVisible, setAiFormVisible] = useState(false);

  /* drawer progetto */
  const [projDrawerOpen, setProjDrawerOpen] = useState(false);
  const [projForm, setProjForm] = useState<ProjectForm>(emptyProjectForm());

  /* sezioni collassabili */
  const [secContatti, setSecContatti] = useState(false);
  const [secTecnica, setSecTecnica] = useState(false);
  const [secFlag, setSecFlag] = useState(false);

  /* search associazione */
  const [associateProjectId, setAssociateProjectId] = useState("");
  const [associateSearch, setAssociateSearch] = useState("");
  const [associateSearchDebounced, setAssociateSearchDebounced] = useState("");
  const [associateOpen, setAssociateOpen] = useState(false);

  /* workspace users */
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserRow[]>([]);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [userFormEmail, setUserFormEmail] = useState("");
  const [userFormRole, setUserFormRole] = useState<WorkspaceUserRole>("collaborator");
  const [userFormAccessScope, setUserFormAccessScope] = useState<AccessScope>("all");
  const [userFormProjectIds, setUserFormProjectIds] = useState<string[]>([]);

  const { roles: workspaceRoles } = useWorkspaceRoles();

  useEffect(() => {
    const t = setTimeout(() => setAssociateSearchDebounced(associateSearch), 300);
    return () => clearTimeout(t);
  }, [associateSearch]);

  /* ── loaders ── */

  const loadWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await followupApi.listWorkspaces();
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento workspace");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectsByEmail = async () => {
    if (!email) return;
    try {
      const res = await followupApi.getProjectsByEmail(email);
      if (res.found && res.projects) setAllProjects(res.projects);
    } catch {
      setAllProjects([]);
    }
  };

  useEffect(() => { void loadWorkspaces(); }, []);
  useEffect(() => { void loadProjectsByEmail(); }, [email]);

  const openProjectList = async (ws: WorkspaceRow) => {
    setSelectedWs(ws);
    setAssociateProjectId("");
    setAssociateSearch("");
    setAssociateOpen(false);
    try {
      const [projRes, usersRes] = await Promise.all([
        followupApi.listWorkspaceProjects(ws._id),
        followupApi.listWorkspaceUsers(ws._id).catch(() => ({ data: [] })),
      ]);
      setProjects(projRes.data ?? []);
      setWorkspaceUsers(usersRes.data ?? []);
    } catch {
      setProjects([]);
      setWorkspaceUsers([]);
    }
  };

  /* ── handlers workspace ── */

  const openCreateWs = () => {
    setWsDrawerMode("create");
    setWsFormName("");
    setWsDrawerOpen(true);
  };

  const openEditWs = (ws: WorkspaceRow) => {
    setSelectedWs(ws);
    setWsDrawerMode("edit");
    setWsFormName(ws.name);
    setWsDrawerOpen(true);
  };

  const handleSaveWs = async () => {
    if (!wsFormName.trim()) return;
    setSaving(true);
    try {
      if (wsDrawerMode === "create") {
        await followupApi.createWorkspace({ name: wsFormName.trim() });
      } else if (selectedWs) {
        await followupApi.updateWorkspace(selectedWs._id, { name: wsFormName.trim() });
      }
      setWsDrawerOpen(false);
      void loadWorkspaces();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio workspace");
    } finally {
      setSaving(false);
    }
  };

  const loadWorkspaceBranding = async (workspaceId: string) => {
    setBrandingLoading(true);
    try {
      const b = await followupApi.getWorkspaceBranding(workspaceId);
      setWorkspaceBranding(b);
    } catch {
      setWorkspaceBranding(null);
    } finally {
      setBrandingLoading(false);
    }
  };

  const loadWorkspaceAiConfig = async (workspaceId: string) => {
    setAiConfigLoading(true);
    try {
      const c = await followupApi.getWorkspaceAiConfig(workspaceId);
      setWorkspaceAiConfig(c);
      setAiFormVisible(false);
      setAiFormApiKey("");
      if (c.provider) setAiFormProvider(c.provider);
    } catch {
      setWorkspaceAiConfig(null);
    } finally {
      setAiConfigLoading(false);
    }
  };

  useEffect(() => {
    if (wsDrawerOpen && wsDrawerMode === "edit" && selectedWs?._id) {
      void loadWorkspaceBranding(selectedWs._id);
      void loadWorkspaceAiConfig(selectedWs._id);
    } else {
      setWorkspaceBranding(null);
      setWorkspaceAiConfig(null);
      setAiFormVisible(false);
      setAiFormApiKey("");
    }
  }, [wsDrawerOpen, wsDrawerMode, selectedWs?._id]);

  const handleSaveAiConfig = async () => {
    if (!selectedWs?._id) return;
    const keyTrimmed = aiFormApiKey.trim();
    if (!keyTrimmed) {
      toastError("Inserisci una API key.");
      return;
    }
    setAiConfigSaving(true);
    try {
      await followupApi.putWorkspaceAiConfig(selectedWs._id, { provider: aiFormProvider, apiKey: keyTrimmed });
      toastSuccess("Provider AI collegato. Le funzioni AI sono abilitate per questo workspace.");
      await loadWorkspaceAiConfig(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio configurazione AI");
    } finally {
      setAiConfigSaving(false);
    }
  };

  const handleRemoveAiConfig = async () => {
    if (!selectedWs?._id || !window.confirm("Rimuovere il provider AI da questo workspace?")) return;
    setAiConfigSaving(true);
    try {
      await followupApi.putWorkspaceAiConfig(selectedWs._id, { provider: aiFormProvider, apiKey: "" });
      toastSuccess("Provider AI rimosso.");
      await loadWorkspaceAiConfig(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione configurazione AI");
    } finally {
      setAiConfigSaving(false);
    }
  };

  const handleUploadLogo = async (files: FileList | null) => {
    if (!files?.length || !selectedWs?._id) return;
    setLogoUploading(true);
    try {
      const file = files[0];
      const { uploadUrl, key } = await followupApi.getAssetUploadUrl(selectedWs._id, {
        type: "branding",
        name: file.name,
        mimeType: file.type || "image/png",
        fileSize: file.size,
      });
      await followupApi.uploadFileToPresignedUrl(uploadUrl, file);
      const created = await followupApi.createAsset(selectedWs._id, {
        key,
        type: "branding",
        name: file.name,
        mimeType: file.type || "image/png",
        fileSize: file.size,
      });
      await followupApi.putWorkspaceBranding(selectedWs._id, { logoAssetId: created.data._id });
      toastSuccess("Logo aggiornato");
      void loadWorkspaceBranding(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadEmailHeader = async (files: FileList | null) => {
    if (!files?.length || !selectedWs?._id) return;
    setEmailHeaderUploading(true);
    try {
      const file = files[0];
      const { uploadUrl, key } = await followupApi.getAssetUploadUrl(selectedWs._id, {
        type: "branding",
        name: file.name,
        mimeType: file.type || "image/png",
        fileSize: file.size,
      });
      await followupApi.uploadFileToPresignedUrl(uploadUrl, file);
      const created = await followupApi.createAsset(selectedWs._id, {
        key,
        type: "branding",
        name: file.name,
        mimeType: file.type || "image/png",
        fileSize: file.size,
      });
      await followupApi.putWorkspaceBranding(selectedWs._id, { emailHeaderAssetId: created.data._id });
      toastSuccess("Email header aggiornato");
      void loadWorkspaceBranding(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore upload email header");
    } finally {
      setEmailHeaderUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!selectedWs?._id) return;
    try {
      await followupApi.putWorkspaceBranding(selectedWs._id, { logoAssetId: "" });
      toastSuccess("Logo rimosso");
      void loadWorkspaceBranding(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione logo");
    }
  };

  const handleRemoveEmailHeader = async () => {
    if (!selectedWs?._id) return;
    try {
      await followupApi.putWorkspaceBranding(selectedWs._id, { emailHeaderAssetId: "" });
      toastSuccess("Email header rimosso");
      void loadWorkspaceBranding(selectedWs._id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione email header");
    }
  };

  const handleDeleteWs = async (ws: WorkspaceRow) => {
    if (!window.confirm(`Eliminare workspace "${ws.name}"?`)) return;
    setSaving(true);
    try {
      await followupApi.deleteWorkspace(ws._id);
      setSelectedWs(null);
      void loadWorkspaces();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore eliminazione");
    } finally {
      setSaving(false);
    }
  };

  /* ── handlers progetto ── */

  const openCreateProject = () => {
    setProjForm(emptyProjectForm());
    setSecContatti(false);
    setSecTecnica(false);
    setSecFlag(false);
    setProjDrawerOpen(true);
  };

  const setPF = (patch: Partial<ProjectForm>) =>
    setProjForm((prev) => ({ ...prev, ...patch }));

  const handleCreateProject = async () => {
    if (!projForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await followupApi.createProject({
        name: projForm.name.trim(),
        displayName: projForm.displayName.trim() || undefined,
        mode: projForm.mode,
        city: projForm.city.trim() || undefined,
        payoff: projForm.payoff.trim() || undefined,
        contactEmail: projForm.contactEmail.trim() || undefined,
        contactPhone: projForm.contactPhone.trim() || undefined,
        projectUrl: projForm.projectUrl.trim() || undefined,
        customDomain: projForm.customDomain.trim() || undefined,
        defaultLang: projForm.defaultLang.trim() || "it",
        hostKey: projForm.hostKey.trim() || undefined,
        assetKey: projForm.assetKey.trim() || undefined,
        feVendorKey: projForm.feVendorKey.trim() || undefined,
        automaticQuoteEnabled: projForm.automaticQuoteEnabled,
        accountManagerEnabled: projForm.accountManagerEnabled,
        hasDAS: projForm.hasDAS,
        broker: projForm.broker.trim() || null,
        iban: projForm.iban.trim() || undefined,
      });
      setProjDrawerOpen(false);
      await loadProjectsByEmail();
      const wsId = selectedWs?._id;
      if (wsId) {
        await followupApi.associateProjectToWorkspace({
          workspaceId: wsId,
          projectId: res.project.id,
        });
        openProjectList(selectedWs!);
      }
      // Link "Configura progetto" (Opzione B): redirect a ProjectDetailPage per policies, email, templates
      navigate(`/projects/${res.project.id}${wsId ? `?workspaceId=${wsId}` : ""}`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore creazione progetto");
    } finally {
      setSaving(false);
    }
  };

  /* ── handlers associazione ── */

  const handleAssociate = async () => {
    if (!selectedWs || !associateProjectId.trim()) return;
    setSaving(true);
    try {
      await followupApi.associateProjectToWorkspace({
        workspaceId: selectedWs._id,
        projectId: associateProjectId.trim(),
      });
      setAssociateProjectId("");
      setAssociateSearch("");
      openProjectList(selectedWs);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore associazione");
    } finally {
      setSaving(false);
    }
  };

  const openAddUser = () => {
    setUserFormEmail("");
    setUserFormRole("collaborator");
    setUserFormAccessScope("all");
    setUserFormProjectIds([]);
    setUserDrawerOpen(true);
  };

  const handleAddWorkspaceUser = async () => {
    if (!selectedWs || !userFormEmail.trim()) return;
    const email = userFormEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError("Inserisci un'email valida.");
      return;
    }
    setSaving(true);
    try {
      await followupApi.addWorkspaceUser(selectedWs._id, {
        userId: email,
        role: userFormRole,
        access_scope: userFormAccessScope,
      });
      if (userFormProjectIds.length > 0) {
        for (const projectId of userFormProjectIds) {
          await followupApi.addWorkspaceUserProject(selectedWs._id, email, projectId);
        }
      }
      setUserDrawerOpen(false);
      openProjectList(selectedWs);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore aggiunta utente");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWorkspaceUser = async (wu: WorkspaceUserRow) => {
    if (!selectedWs) return;
    if (!window.confirm(`Rimuovere ${wu.userId} dal workspace?`)) return;
    setSaving(true);
    try {
      await followupApi.removeWorkspaceUser(selectedWs._id, wu.userId);
      openProjectList(selectedWs);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione utente");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateWorkspaceUserRole = async (wu: WorkspaceUserRow, newRole: WorkspaceUserRole) => {
    if (!selectedWs) return;
    setSaving(true);
    try {
      await followupApi.updateWorkspaceUser(selectedWs._id, wu.userId, { role: newRole });
      openProjectList(selectedWs);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore aggiornamento ruolo");
    } finally {
      setSaving(false);
    }
  };

  const handleDissociate = async (projectId: string) => {
    if (!selectedWs) return;
    const proj = allProjects.find((p) => p.id === projectId);
    const label = proj?.displayName ?? proj?.name ?? "questo progetto";
    if (!window.confirm(`Rimuovere ${label} da questo workspace?`)) return;
    setSaving(true);
    try {
      await followupApi.dissociateProjectFromWorkspace(selectedWs._id, projectId);
      openProjectList(selectedWs);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione");
    } finally {
      setSaving(false);
    }
  };

  /* ── render ── */

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        {/* header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestione workspace e associazioni progetti. Solo admin può creare e modificare.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11 rounded-lg" onClick={openCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo progetto
            </Button>
            <Button className="min-h-11 rounded-lg" onClick={openCreateWs}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo workspace
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-lg border border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
            Caricamento...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="mt-8 rounded-lg border border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
            Nessun workspace. Crea il primo per iniziare.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {workspaces.map((ws) => (
              <div
                key={ws._id}
                className={cn(
                  "rounded-ui border border-border bg-background p-4 shadow-sm",
                  selectedWs?._id === ws._id && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-foreground">{ws.name}</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => (selectedWs?._id === ws._id ? setSelectedWs(null) : openProjectList(ws))}
                    >
                      {selectedWs?._id === ws._id ? "Nascondi" : "Progetti"}
                    </Button>
                    <Button variant="outline" size="icon" className="min-h-11 min-w-11" onClick={() => openEditWs(ws)} aria-label="Modifica">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteWs(ws)}
                      disabled={saving}
                      aria-label="Elimina"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {selectedWs?._id === ws._id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-6">
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-foreground flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Utenti nel workspace
                      </h4>
                      <div className="mb-2">
                        <Button size="sm" variant="outline" onClick={openAddUser} className="min-h-11 gap-1">
                          <UserPlus className="h-3.5 w-3.5" />
                          Aggiungi utente
                        </Button>
                      </div>
                      {workspaceUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun utente. Aggiungi utenti per gestire ruoli e visibilità.</p>
                      ) : (
                        <ul className="space-y-1">
                          {workspaceUsers.map((wu) => (
                            <li
                              key={wu._id}
                              className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                            >
                              <span className="text-foreground font-medium">{wu.userId}</span>
                              <div className="flex items-center gap-2">
                                <select
                                  value={wu.role}
                                  onChange={(e) => handleUpdateWorkspaceUserRole(wu, e.target.value as WorkspaceUserRole)}
                                  disabled={saving}
                                  className="h-7 rounded border border-border bg-background px-2 text-xs"
                                >
                                  {workspaceRoles.map((r) => (
                                    <option key={r.roleKey} value={r.roleKey}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                                {wu.access_scope != null && (
                                  <span className="text-xs text-muted-foreground">
                                    {wu.access_scope === "assigned" ? "Solo assegnati" : "Tutto"}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveWorkspaceUser(wu)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                    <h4 className="mb-2 text-sm font-medium text-foreground">Progetti associati</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Button size="sm" variant="outline" onClick={openCreateProject} className="min-h-11">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Nuovo progetto
                      </Button>
                      <div className="relative min-w-[240px]">
                        <Input
                          value={associateSearch}
                          onChange={(e) => {
                            setAssociateSearch(e.target.value);
                            setAssociateOpen(true);
                            if (!e.target.value) setAssociateProjectId("");
                          }}
                          onFocus={() => setAssociateOpen(true)}
                          placeholder="Cerca progetto…"
                          className="h-9 text-sm"
                        />
                        {associateOpen && (
                          <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-ui border border-border bg-background shadow-lg">
                            {allProjects
                              .filter((p) => !projects.some((wp) => wp.projectId === p.id))
                              .filter((p) => {
                                const q = associateSearchDebounced.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  (p.displayName ?? "").toLowerCase().includes(q) ||
                                  (p.name ?? "").toLowerCase().includes(q) ||
                                  p.id.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 50)
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 truncate"
                                  onMouseDown={() => {
                                    setAssociateProjectId(p.id);
                                    setAssociateSearch(p.displayName ?? p.name ?? p.id);
                                    setAssociateOpen(false);
                                  }}
                                >
                                  <span className="font-medium">{p.displayName ?? p.name ?? p.id}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{p.id}</span>
                                </button>
                              ))}
                            {allProjects
                              .filter((p) => !projects.some((wp) => wp.projectId === p.id))
                              .filter((p) => {
                                const q = associateSearchDebounced.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  (p.displayName ?? "").toLowerCase().includes(q) ||
                                  (p.name ?? "").toLowerCase().includes(q) ||
                                  p.id.toLowerCase().includes(q)
                                );
                              }).length === 0 && (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                {associateSearchDebounced.trim() ? "Nessun risultato" : "Digita per cercare"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <Button size="sm" onClick={handleAssociate} disabled={!associateProjectId.trim() || saving} className="min-h-11">
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Associa
                      </Button>
                    </div>
                    <ul className="space-y-1">
                      {projects.map((wp) => {
                        const proj = allProjects.find((p) => p.id === wp.projectId);
                        const label = proj?.displayName ?? proj?.name ?? "Progetto";
                        return (
                          <li
                            key={wp.projectId}
                            className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                          >
                            <span className="text-foreground">{label}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-11 min-w-11 text-muted-foreground hover:text-primary"
                                onClick={() => navigate(`/projects/${wp.projectId}?workspaceId=${selectedWs._id}`)}
                                title="Dettaglio progetto"
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-11 min-w-11 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDissociate(wp.projectId)}
                                disabled={saving}
                              >
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                      {projects.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nessun progetto associato</p>
                      )}
                    </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Drawer workspace (crea / modifica) ── */}
      <Drawer open={wsDrawerOpen} onOpenChange={setWsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>
              {wsDrawerMode === "create" ? "Nuovo workspace" : "Modifica workspace"}
            </DrawerTitle>
            <DrawerSubtitle>
              {wsDrawerMode === "create"
                ? "Crea un gruppo logico per organizzare i tuoi progetti."
                : "Aggiorna il nome del workspace."}
            </DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody className="space-y-5">
            <Field label="Nome workspace" required hint="Es. Milano Residenziale, Progetto Beta, …">
              <Input
                value={wsFormName}
                onChange={(e) => setWsFormName(e.target.value)}
                placeholder="Es. Test Workspace"
                autoFocus
              />
            </Field>

            {wsDrawerMode === "edit" && selectedWs && (
              <div className="space-y-3 pt-2 border-t border-border">
                <SectionTitle label="Branding (logo e email)" open={secBranding} onToggle={() => setSecBranding(!secBranding)} />
                {secBranding && (
                  <div className="space-y-4">
                    {brandingLoading ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Caricamento…
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Logo workspace</p>
                          {workspaceBranding?.logoDownloadUrl ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={workspaceBranding.logoDownloadUrl}
                                alt="Logo"
                                className="h-12 object-contain border border-border rounded"
                              />
                              <div className="flex flex-wrap gap-2">
                                <FileUpload
                                  title={logoUploading ? "Caricamento…" : "Sostituisci"}
                                  onFilesSelected={handleUploadLogo}
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  disabled={logoUploading}
                                />
                                <Button variant="ghost" size="sm" className="min-h-11" onClick={handleRemoveLogo} disabled={logoUploading}>
                                  Rimuovi
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <FileUpload
                              title={logoUploading ? "Caricamento…" : "Carica logo"}
                              subtitle="Per email e comunicazioni"
                              onFilesSelected={handleUploadLogo}
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              disabled={logoUploading}
                            />
                          )}
                          {logoUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Header email</p>
                          {workspaceBranding?.emailHeaderDownloadUrl ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={workspaceBranding.emailHeaderDownloadUrl}
                                alt="Header email"
                                className="max-h-14 object-contain border border-border rounded"
                              />
                              <div className="flex flex-wrap gap-2">
                                <FileUpload
                                  title={emailHeaderUploading ? "Caricamento…" : "Sostituisci"}
                                  onFilesSelected={handleUploadEmailHeader}
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  disabled={emailHeaderUploading}
                                />
                                <Button variant="ghost" size="sm" className="min-h-11" onClick={handleRemoveEmailHeader} disabled={emailHeaderUploading}>
                                  Rimuovi
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <FileUpload
                              title={emailHeaderUploading ? "Caricamento…" : "Carica header email"}
                              subtitle="Immagine in testa alle email"
                              onFilesSelected={handleUploadEmailHeader}
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              disabled={emailHeaderUploading}
                            />
                          )}
                          {emailHeaderUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <SectionTitle label="Provider AI" open={secAi} onToggle={() => setSecAi(!secAi)} />
                {secAi && (
                  <div className="space-y-4">
                    {aiConfigLoading ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Caricamento…
                      </p>
                    ) : workspaceAiConfig?.configured && !aiFormVisible ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Connesso: <span className="font-medium text-foreground">{workspaceAiConfig.provider ?? "—"}</span>
                          {workspaceAiConfig.apiKeyMasked && (
                            <span className="ml-1 text-xs text-muted-foreground">({workspaceAiConfig.apiKeyMasked})</span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="min-h-11" onClick={() => setAiFormVisible(true)} disabled={aiConfigSaving}>
                            Cambia
                          </Button>
                          <Button variant="ghost" size="sm" className="min-h-11 text-destructive hover:text-destructive" onClick={handleRemoveAiConfig} disabled={aiConfigSaving}>
                            Rimuovi
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Field label="Provider" hint="Claude, OpenAI, Gemini">
                          <Select value={aiFormProvider} onValueChange={setAiFormProvider}>
                            <SelectTrigger className="min-h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                              <SelectItem value="openai">ChatGPT (OpenAI)</SelectItem>
                              <SelectItem value="gemini">Gemini (Google)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="API key" required hint="Incolla la chiave dal portale del provider. Non verrà mostrata dopo il salvataggio.">
                          <Input
                            type="password"
                            value={aiFormApiKey}
                            onChange={(e) => setAiFormApiKey(e.target.value)}
                            placeholder="sk-…"
                            className="min-h-11"
                            autoComplete="off"
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleSaveAiConfig} disabled={!aiFormApiKey.trim() || aiConfigSaving} className="min-h-11">
                            {aiConfigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                            {aiConfigSaving ? "Salvataggio…" : "Salva e connetti"}
                          </Button>
                          {workspaceAiConfig?.configured && (
                            <Button variant="outline" onClick={() => { setAiFormVisible(false); setAiFormApiKey(""); }} className="min-h-11" disabled={aiConfigSaving}>
                              Annulla
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {wsDrawerMode === "create" && (
              <p className="pt-2 text-xs text-muted-foreground border-t border-border">
                Dopo aver creato il workspace potrai collegare un provider AI (Claude, ChatGPT, Gemini) in Modifica per abilitare i suggerimenti e le funzioni AI.
              </p>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleSaveWs} disabled={!wsFormName.trim() || saving} className="w-full min-h-11">
              {wsDrawerMode === "create" ? "Crea workspace" : "Salva modifiche"}
            </Button>
            <Button variant="outline" onClick={() => setWsDrawerOpen(false)} className="w-full min-h-11">
              Annulla
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Drawer nuovo progetto ── */}
      <Drawer open={projDrawerOpen} onOpenChange={setProjDrawerOpen}>
        <DrawerContent className="max-w-xl">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Nuovo progetto</DrawerTitle>
            <DrawerSubtitle>
              Configura il progetto immobiliare. I campi con * sono obbligatori.
            </DrawerSubtitle>
          </DrawerHeader>

          <DrawerBody className="space-y-6">
            {/* ── Sezione 1: Identità ── */}
            <div className="space-y-4">
              <SectionTitle label="Identità" open={true} onToggle={() => {}} />
              <Field label="Nome" required hint="Identificatore interno del progetto">
                <Input
                  value={projForm.name}
                  onChange={(e) => setPF({ name: e.target.value })}
                  placeholder="Es. arborea"
                  autoFocus
                />
              </Field>
              <Field label="Nome visualizzato" hint="Nome mostrato all'utente nell'app">
                <Input
                  value={projForm.displayName}
                  onChange={(e) => setPF({ displayName: e.target.value })}
                  placeholder="Es. Arborea Living"
                />
              </Field>
              <Field label="Tipo" required>
                <select
                  value={projForm.mode}
                  onChange={(e) => setPF({ mode: e.target.value as "rent" | "sell" })}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="sell">Vendita (Sell)</option>
                  <option value="rent">Affitto (Rent)</option>
                </select>
              </Field>
              <Field label="Città" hint="Città del progetto">
                <Input
                  value={projForm.city}
                  onChange={(e) => setPF({ city: e.target.value })}
                  placeholder="Es. Milano"
                />
              </Field>
              <Field label="Payoff / Tagline" hint="Breve frase descrittiva del progetto">
                <Input
                  value={projForm.payoff}
                  onChange={(e) => setPF({ payoff: e.target.value })}
                  placeholder="Es. Il tuo habitat a Milano"
                />
              </Field>
            </div>

            {/* ── Sezione 2: Contatti & Web ── */}
            <div className="space-y-4">
              <SectionTitle label="Contatti & Web" open={secContatti} onToggle={() => setSecContatti((v) => !v)} />
              {secContatti && (
                <>
                  <Field label="Email contatto">
                    <Input
                      type="email"
                      value={projForm.contactEmail}
                      onChange={(e) => setPF({ contactEmail: e.target.value })}
                      placeholder="info@progetto.it"
                    />
                  </Field>
                  <Field label="Telefono contatto">
                    <Input
                      value={projForm.contactPhone}
                      onChange={(e) => setPF({ contactPhone: e.target.value })}
                      placeholder="+39 02 12345678"
                    />
                  </Field>
                  <Field label="URL progetto" hint="Sito web principale">
                    <Input
                      value={projForm.projectUrl}
                      onChange={(e) => setPF({ projectUrl: e.target.value })}
                      placeholder="https://www.progetto.it"
                    />
                  </Field>
                  <Field label="Dominio custom" hint="Dominio personalizzato per l'app">
                    <Input
                      value={projForm.customDomain}
                      onChange={(e) => setPF({ customDomain: e.target.value })}
                      placeholder="app.progetto.it"
                    />
                  </Field>
                </>
              )}
            </div>

            {/* ── Sezione 3: Configurazione tecnica ── */}
            <div className="space-y-4">
              <SectionTitle label="Configurazione tecnica" open={secTecnica} onToggle={() => setSecTecnica((v) => !v)} />
              {secTecnica && (
                <>
                  <Field label="Host Key" hint="Auto-generato se non impostato">
                    <Input
                      value={projForm.hostKey}
                      onChange={(e) => setPF({ hostKey: e.target.value })}
                      placeholder="www.progetto.it"
                    />
                  </Field>
                  <Field label="Asset Key" hint="Chiave per accedere agli asset (default = id progetto)">
                    <Input
                      value={projForm.assetKey}
                      onChange={(e) => setPF({ assetKey: e.target.value })}
                      placeholder="progettoAssetKey"
                    />
                  </Field>
                  <Field label="FE Vendor Key" hint="Chiave vendor per il frontend">
                    <Input
                      value={projForm.feVendorKey}
                      onChange={(e) => setPF({ feVendorKey: e.target.value })}
                      placeholder="gs"
                    />
                  </Field>
                  <Field label="Lingua di default">
                    <select
                      value={projForm.defaultLang}
                      onChange={(e) => setPF({ defaultLang: e.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="it">Italiano (it)</option>
                      <option value="en">English (en)</option>
                      <option value="de">Deutsch (de)</option>
                      <option value="fr">Français (fr)</option>
                      <option value="zh">中文 (zh)</option>
                      <option value="ar">عربي (ar)</option>
                    </select>
                  </Field>
                </>
              )}
            </div>

            {/* ── Sezione 4: Flag & Avanzate ── */}
            <div className="space-y-4">
              <SectionTitle label="Flag & Avanzate" open={secFlag} onToggle={() => setSecFlag((v) => !v)} />
              {secFlag && (
                <>
                  {(
                    [
                      ["automaticQuoteEnabled", "Preventivo automatico abilitato"],
                      ["accountManagerEnabled", "Account manager abilitato"],
                      ["hasDAS", "DAS abilitato"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={projForm[key]}
                        onChange={(e) => setPF({ [key]: e.target.checked })}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm text-foreground">{label}</span>
                    </label>
                  ))}
                  <Field label="Broker" hint="ID o nome del broker associato">
                    <Input
                      value={projForm.broker}
                      onChange={(e) => setPF({ broker: e.target.value })}
                      placeholder="Es. broker-id-xyz"
                    />
                  </Field>
                  <Field label="IBAN" hint="IBAN aziendale per questo progetto">
                    <Input
                      value={projForm.iban}
                      onChange={(e) => setPF({ iban: e.target.value })}
                      placeholder="IT00 0000 0000 0000 0000 0000 0"
                    />
                  </Field>
                </>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button onClick={handleCreateProject} disabled={!projForm.name.trim() || saving} className="w-full min-h-11">
              Crea progetto
            </Button>
            <Button variant="outline" onClick={() => setProjDrawerOpen(false)} className="w-full min-h-11">
              Annulla
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Drawer aggiungi utente ── */}
      <Drawer open={userDrawerOpen} onOpenChange={setUserDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Aggiungi utente</DrawerTitle>
            <DrawerSubtitle>
              Aggiungi un utente al workspace con ruolo e tipo di accesso (Tutto / Solo assegnati).
            </DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody className="space-y-5">
            <Field label="Email" required>
              <Input
                type="email"
                placeholder="utente@esempio.it"
                value={userFormEmail}
                onChange={(e) => setUserFormEmail(e.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Ruolo">
              <Select
                value={userFormRole}
                onValueChange={(v) => setUserFormRole(v as WorkspaceUserRole)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaceRoles.map((r) => (
                    <SelectItem key={r.roleKey} value={r.roleKey}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Accesso" hint="Tutto = vede tutto il workspace; Solo assegnati = solo elementi assegnati.">
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="access_scope"
                    checked={userFormAccessScope === "all"}
                    onChange={() => setUserFormAccessScope("all")}
                    disabled={saving}
                    className="rounded-full border-border accent-primary"
                  />
                  Tutto
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="access_scope"
                    checked={userFormAccessScope === "assigned"}
                    onChange={() => setUserFormAccessScope("assigned")}
                    disabled={saving}
                    className="rounded-full border-border accent-primary"
                  />
                  Solo assegnati
                </label>
              </div>
            </Field>
            {selectedWs && projects.length > 0 && (
              <div className="space-y-2">
                <Field label="Progetti visibili nel workspace" hint="Se nessuno selezionato, l'utente vedrà tutti i progetti del workspace.">
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded-md border border-border p-2">
                    {projects.map((wp) => {
                      const proj = allProjects.find((p) => p.id === wp.projectId);
                      const label = proj?.displayName ?? proj?.name ?? wp.projectId;
                      const checked = userFormProjectIds.includes(wp.projectId);
                      return (
                        <label key={wp.projectId} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserFormProjectIds((prev) => [...prev, wp.projectId]);
                              } else {
                                setUserFormProjectIds((prev) => prev.filter((id) => id !== wp.projectId));
                              }
                            }}
                            disabled={saving}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleAddWorkspaceUser} disabled={saving || !userFormEmail.trim()} className="min-h-11">
              Aggiungi
            </Button>
            <Button variant="outline" onClick={() => setUserDrawerOpen(false)} className="w-full min-h-11">
              Annulla
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
