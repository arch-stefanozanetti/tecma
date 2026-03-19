/**
 * Tab Overview progetto: vista visiva con gallery, KPI, lista appartamenti a card.
 * Upload immagini progetto e planimetrie via signed URL.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/button";
import { FileUpload } from "../../components/ui/file-upload";
import { cn } from "../../lib/utils";
import type { ApartmentRow, AssetRow } from "../../types/domain";
import { ImagePlus, LayoutGrid, ExternalLink, Loader2 } from "lucide-react";

type ProjectOverviewTabProps = {
  projectId: string;
  workspaceId: string;
  projectName: string;
  projectMode: "rent" | "sell";
  onRefresh?: () => void;
};

export const ProjectOverviewTab = ({
  projectId,
  workspaceId,
  projectName,
  projectMode,
  onRefresh,
}: ProjectOverviewTabProps) => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadUrlCache, setDownloadUrlCache] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setLoading(true);
    try {
      const [assetsRes, aptRes] = await Promise.all([
        followupApi.listAssets(workspaceId, { projectId, type: "image" }).catch(() => ({ data: [] })),
        followupApi.apartments.queryApartments({
          workspaceId,
          projectIds: [projectId],
          page: 1,
          perPage: 200,
        }),
      ]);
      setAssets(assetsRes.data ?? []);
      setApartments(aptRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getAssetPreviewUrl = useCallback(
    async (assetId: string): Promise<string | null> => {
      if (downloadUrlCache[assetId]) return downloadUrlCache[assetId];
      try {
        const res = await followupApi.getAssetDownloadUrl(workspaceId, assetId);
        setDownloadUrlCache((prev) => ({ ...prev, [assetId]: res.downloadUrl }));
        return res.downloadUrl;
      } catch {
        return null;
      }
    },
    [workspaceId, downloadUrlCache]
  );

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (assets.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      for (const a of assets.slice(0, 12)) {
        if (cancelled) break;
        const url = await getAssetPreviewUrl(a._id);
        if (url) next[a._id] = url;
      }
      if (!cancelled) setPreviewUrls((prev) => ({ ...prev, ...next }));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [assets.length, assets.slice(0, 12).map((a) => a._id).join(","), getAssetPreviewUrl]);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files?.length || !workspaceId || !projectId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { uploadUrl, key, expiresAt } = await followupApi.getAssetUploadUrl(workspaceId, {
          type: "image",
          name: file.name,
          mimeType: file.type || "image/jpeg",
          fileSize: file.size,
          projectId,
        });
        await followupApi.uploadFileToPresignedUrl(uploadUrl, file);
        await followupApi.createAsset(workspaceId, {
          key,
          type: "image",
          name: file.name,
          mimeType: file.type || "image/jpeg",
          fileSize: file.size,
          projectId,
        });
      }
      toastSuccess("Immagine/i caricate");
      void loadData();
      onRefresh?.();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const planimetryByApartment = useCallback(
    async (apartmentId: string): Promise<AssetRow | null> => {
      const res = await followupApi.listAssets(workspaceId, { projectId, apartmentId, type: "planimetry" });
      return res.data?.[0] ?? null;
    },
    [workspaceId, projectId]
  );

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caricamento overview…
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Gallery */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold text-foreground">Immagini progetto</h2>
          <div className="flex items-center gap-2">
            <FileUpload
              title={uploading ? "Caricamento…" : "Aggiungi immagini"}
              onFilesSelected={handleFilesSelected}
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={uploading}
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
        {assets.length === 0 ? (
          <div
            className={cn(
              "rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground",
              "flex flex-col items-center gap-2"
            )}
          >
            <ImagePlus className="h-10 w-10 text-muted-foreground/60" />
            <span>Nessuna immagine. Carica cover o gallery per il progetto.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {assets.map((a) => (
              <div
                key={a._id}
                className="aspect-video rounded-lg border border-border bg-muted overflow-hidden"
              >
                {previewUrls[a._id] ? (
                  <img
                    src={previewUrls[a._id]}
                    alt={a.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    …
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KPI placeholder */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">In sintesi</h2>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs font-medium text-muted-foreground">Appartamenti</p>
            <p className="text-xl font-semibold text-foreground">{apartments.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs font-medium text-muted-foreground">Modalità</p>
            <p className="text-xl font-semibold text-foreground">{projectMode === "rent" ? "Affitto" : "Vendita"}</p>
          </div>
        </div>
      </section>

      {/* Appartamenti a card */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            Appartamenti
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/apartments?workspaceId=${workspaceId}&projectId=${projectId}`)}
            className="gap-2"
          >
            Vedi tutti
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
        {apartments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun appartamento in questo progetto.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apartments.slice(0, 12).map((apt) => (
              <ApartmentCard
                key={apt._id}
                apartment={apt}
                workspaceId={workspaceId}
                projectId={projectId}
                planimetryByApartment={planimetryByApartment}
                onOpen={() => navigate(`/apartments/${apt._id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const ApartmentCard = ({
  apartment,
  workspaceId,
  projectId,
  planimetryByApartment,
  onOpen,
}: {
  apartment: ApartmentRow;
  workspaceId: string;
  projectId: string;
  planimetryByApartment: (apartmentId: string) => Promise<AssetRow | null>;
  onOpen: () => void;
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    planimetryByApartment(apartment._id).then(async (plan) => {
      if (cancelled || !plan) return;
      try {
        const res = await followupApi.getAssetDownloadUrl(workspaceId, plan._id);
        if (!cancelled) setPreviewUrl(res.downloadUrl);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apartment._id, workspaceId, planimetryByApartment]);

  const price =
    apartment.normalizedPrice?.display ??
    (apartment.rawPrice?.amount != null
      ? apartment.mode === "RENT"
        ? `€ ${Number(apartment.rawPrice.amount).toLocaleString("it-IT")}/mese`
        : `€ ${Number(apartment.rawPrice.amount).toLocaleString("it-IT")}`
      : "—");
  const status = apartment.status ?? "AVAILABLE";
  const statusLabel =
    status === "AVAILABLE"
      ? "Disponibile"
      : status === "SOLD" || status === "RENTED"
        ? "Venduto/Affittato"
        : status === "RESERVED"
          ? "Riservato"
          : status;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "rounded-lg border border-border bg-card text-left overflow-hidden",
        "hover:border-primary/50 hover:shadow-sm transition-all",
        "flex flex-col"
      )}
    >
      <div className="aspect-[4/3] bg-muted relative">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-sm">
            Nessuna planimetria
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 right-2 rounded px-2 py-0.5 text-xs font-medium",
            status === "AVAILABLE" && "bg-green-500/90 text-white",
            (status === "SOLD" || status === "RENTED") && "bg-muted text-muted-foreground",
            status === "RESERVED" && "bg-amber-500/90 text-white"
          )}
        >
          {statusLabel}
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="font-medium text-foreground truncate">
          {apartment.name || apartment.code || apartment._id}
        </p>
        <p className="text-sm text-muted-foreground">{price}</p>
      </div>
    </button>
  );
};
