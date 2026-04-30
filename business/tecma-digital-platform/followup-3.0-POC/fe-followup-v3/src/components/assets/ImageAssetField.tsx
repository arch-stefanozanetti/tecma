import { useEffect, useMemo, useState } from "react";
import { storageApi } from "../../api/domains/storageApi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

type Props = {
  workspaceId: string;
  projectId?: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

export function ImageAssetField({ workspaceId, projectId, value, onChange, label = "Immagine" }: Props) {
  const [prefix, setPrefix] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<Array<{ key: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState("");
  const [uploading, setUploading] = useState(false);

  const selectedPrefix = useMemo(() => prefix || folders[0] || "", [prefix, folders]);

  const load = async (nextPrefix?: string) => {
    setLoading(true);
    try {
      const res = await storageApi.list(workspaceId, {
        projectId,
        prefix: nextPrefix,
      });
      setFolders(res.data.folders || []);
      setFiles((res.data.files || []).map((f) => ({ key: f.key })));
      setPrefix(res.data.prefix || nextPrefix || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId]);

  const handleUpload = async (file: File) => {
    if (!selectedPrefix) return;
    setUploading(true);
    try {
      const up = await storageApi.createUploadUrl(workspaceId, {
        projectId,
        prefix: selectedPrefix,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
      });
      await storageApi.uploadToSignedUrl(up.data.uploadUrl, file);
      const finalUrl = up.data.publicUrl || `${up.data.bucket}/${up.data.key}`;
      onChange(finalUrl);
      await load(selectedPrefix);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const full = creatingFolder.trim();
    if (!full) return;
    await storageApi.createFolder(workspaceId, { projectId, prefix: full });
    setCreatingFolder("");
    await load(full);
  };

  const handleBootstrap = async () => {
    if (!projectId) return;
    await storageApi.bootstrap(workspaceId, { projectId });
    await load();
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Carica</TabsTrigger>
          <TabsTrigger value="library">Libreria</TabsTrigger>
          <TabsTrigger value="url">URL esterno</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="space-y-2 pt-2">
          <Input
            value={selectedPrefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="prefix cartella"
            className="h-8 text-xs"
          />
          <Input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <p className="text-xs text-muted-foreground">{uploading ? "Upload in corso..." : "Carica su bucket OCI"}</p>
        </TabsContent>
        <TabsContent value="library" className="space-y-2 pt-2">
          {projectId ? (
            <Button type="button" size="sm" variant="secondary" onClick={handleBootstrap}>
              Crea struttura standard progetto
            </Button>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={creatingFolder}
              onChange={(e) => setCreatingFolder(e.target.value)}
              placeholder="nuova cartella (prefix/)"
              className="h-8 text-xs"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleCreateFolder}>
              Crea
            </Button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">Caricamento...</p>
            ) : (
              <>
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                    onClick={() => void load(f)}
                  >
                    {f}
                  </button>
                ))}
                {files.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                    onClick={() => onChange(f.key)}
                  >
                    {f.key}
                  </button>
                ))}
              </>
            )}
          </div>
        </TabsContent>
        <TabsContent value="url" className="pt-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." />
        </TabsContent>
      </Tabs>
      {value ? <p className="truncate text-xs text-muted-foreground">{value}</p> : null}
    </div>
  );
}

