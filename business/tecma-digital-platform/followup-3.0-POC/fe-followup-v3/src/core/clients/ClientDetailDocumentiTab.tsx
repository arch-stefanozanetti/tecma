import { FileText, Loader2, Link2, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { FileUpload } from "../../components/ui/file-upload";
import { followupApi } from "../../api/followupApi";
import type { ClientDocumentRow } from "../../types/domain";

export interface ClientDetailDocumentiTabProps {
  workspaceId: string | undefined;
  clientId: string | undefined;
  clientDocuments: ClientDocumentRow[];
  clientDocumentsLoading: boolean;
  documentUploading: boolean;
  documentVisibility: "internal" | "client";
  onDocumentVisibilityChange: (v: "internal" | "client") => void;
  onFilesSelected: (files: FileList | null) => void;
  onRefreshDocuments: () => void;
  shareLinkDocId: string | null;
  onShareLinkDocIdChange: (id: string | null) => void;
  onToastSuccess: (msg: string) => void;
  onToastError: (msg: string) => void;
}

export function ClientDetailDocumentiTab({
  workspaceId,
  clientId,
  clientDocuments,
  clientDocumentsLoading,
  documentUploading,
  documentVisibility,
  onDocumentVisibilityChange,
  onFilesSelected,
  onRefreshDocuments,
  shareLinkDocId,
  onShareLinkDocIdChange,
  onToastSuccess,
  onToastError,
}: ClientDetailDocumentiTabProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Documenti cliente
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Carica proposte, contratti o altri documenti. Visibilità &quot;cliente&quot;: il cliente può vedere il documento (es. via link con scadenza 7 giorni).
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={documentVisibility} onValueChange={(v) => onDocumentVisibilityChange(v as "internal" | "client")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Visibilità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Solo interno</SelectItem>
            <SelectItem value="client">Visibile al cliente</SelectItem>
          </SelectContent>
        </Select>
        <FileUpload
          title={documentUploading ? "Caricamento…" : "Carica documento"}
          onFilesSelected={onFilesSelected}
          accept="application/pdf,.pdf"
          multiple
          disabled={documentUploading}
        />
        {documentUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {clientDocumentsLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento documenti…
        </p>
      ) : clientDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>
      ) : (
        <ul className="space-y-2">
          {clientDocuments.map((doc) => (
            <li
              key={doc._id}
              className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.type} • {doc.visibility === "client" ? "Visibile al cliente" : "Solo interno"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={async () => {
                    if (!workspaceId || !clientId) return;
                    const res = await followupApi.getClientDocumentDownloadUrl(workspaceId, clientId, doc._id);
                    window.open(res.downloadUrl, "_blank");
                  }}
                >
                  Scarica
                </Button>
                {doc.visibility === "client" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={shareLinkDocId === doc._id}
                    onClick={async () => {
                      onShareLinkDocIdChange(doc._id);
                      if (!workspaceId || !clientId) return;
                      try {
                        const res = await followupApi.getClientDocumentShareLink(workspaceId, clientId, doc._id);
                        await navigator.clipboard.writeText(res.downloadUrl);
                        onToastSuccess("Link (7 giorni) copiato negli appunti");
                      } catch (e) {
                        onToastError(e instanceof Error ? e.message : "Errore link");
                      } finally {
                        onShareLinkDocIdChange(null);
                      }
                    }}
                  >
                    {shareLinkDocId === doc._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    Invia link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Eliminare questo documento?")) return;
                    if (!workspaceId || !clientId) return;
                    try {
                      await followupApi.deleteClientDocument(workspaceId, clientId, doc._id);
                      onRefreshDocuments();
                    } catch (e) {
                      onToastError(e instanceof Error ? e.message : "Errore eliminazione");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
