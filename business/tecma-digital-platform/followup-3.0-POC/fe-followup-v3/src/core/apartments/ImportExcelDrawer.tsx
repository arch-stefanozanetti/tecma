/**
 * Drawer per import massivo unit da Excel. Upload → Preview → Execute.
 */
import { useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface ImportExcelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  onImported?: () => void;
}

export const ImportExcelDrawer = ({ open, onOpenChange, workspaceId, projectId, onImported }: ImportExcelDrawerProps) => {
  const { toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    validRows: Array<Record<string, unknown>>;
    errors: Array<{ rowIndex: number; message: string }>;
    duplicates: Array<{ rowIndex: number; unit_code: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState<{
    created: number;
    skipped: number;
    errors: Array<{ rowIndex: number; unit_code: string; message: string }>;
  } | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "overwrite" | "fail">("skip");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setPreview(null);
    setExecuteResult(null);
  };

  const loadPreview = () => {
    if (!file || !workspaceId || !projectId) return;
    setLoading(true);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
      if (!b64) {
        setLoading(false);
        return;
      }
      followupApi
        .unitsImportPreview(workspaceId, projectId, b64)
        .then((res) => setPreview(res))
        .catch((err) => {
          toastError(err?.message ?? "Errore anteprima");
        })
        .finally(() => setLoading(false));
    };
    reader.readAsDataURL(file);
  };

  const handleExecute = () => {
    if (!preview?.validRows?.length || !workspaceId || !projectId) return;
    setLoading(true);
    setExecuteResult(null);
    followupApi
      .unitsImportExecute(workspaceId, projectId, preview.validRows, onDuplicate)
      .then((res) => {
        setExecuteResult(res);
        onImported?.();
      })
      .catch((err) => toastError(err?.message ?? "Errore importazione"))
      .finally(() => setLoading(false));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setExecuteResult(null);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DrawerContent side="right" className="w-full sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Importa Excel</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">File Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-2 file:rounded file:border file:px-3 file:py-1.5 file:text-sm"
              onChange={handleFileChange}
            />
            {file && (
              <Button type="button" size="sm" className="mt-2" onClick={loadPreview} disabled={loading}>
                {loading ? "Caricamento..." : "Carica e anteprima"}
              </Button>
            )}
          </div>

          {preview && (
            <div className="space-y-2 text-sm">
              <p><strong>{preview.validRows.length}</strong> righe valide</p>
              {preview.errors.length > 0 && (
                <p className="text-destructive"><strong>{preview.errors.length}</strong> errori (righe: {preview.errors.map((e) => e.rowIndex).join(", ")})</p>
              )}
              {preview.duplicates.length > 0 && (
                <p className="text-amber-600"><strong>{preview.duplicates.length}</strong> duplicati (unit_code già presenti)</p>
              )}
            </div>
          )}

          {executeResult && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p><strong>Creati:</strong> {executeResult.created}</p>
              <p><strong>Saltati:</strong> {executeResult.skipped}</p>
              {executeResult.errors.length > 0 && (
                <p className="text-destructive"><strong>Errori:</strong> {executeResult.errors.length}</p>
              )}
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          {preview?.validRows?.length ? (
            <>
              <Select value={onDuplicate} onValueChange={(v) => setOnDuplicate(v as "skip" | "overwrite" | "fail")}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Duplicati" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Salta duplicati</SelectItem>
                  <SelectItem value="overwrite">Sovrascrivi</SelectItem>
                  <SelectItem value="fail">Errore su duplicato</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExecute} disabled={loading}>
                {loading ? "Importazione..." : "Importa"}
              </Button>
            </>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
