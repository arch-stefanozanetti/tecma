import type { ApartmentRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { STATUS_FILTER_OPTIONS } from "./apartmentDetailConstants";

export interface ApartmentDetailEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  onCodeChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  status: ApartmentRow["status"];
  onStatusChange: (v: ApartmentRow["status"]) => void;
  surfaceMq: string;
  onSurfaceMqChange: (v: string) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ApartmentDetailEditDrawer({
  open,
  onOpenChange,
  code,
  onCodeChange,
  name,
  onNameChange,
  status,
  onStatusChange,
  surfaceMq,
  onSurfaceMqChange,
  error,
  saving,
  onSubmit,
}: ApartmentDetailEditDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="sm:max-w-md">
        <DrawerHeader actions={<DrawerCloseButton />}>
          <DrawerTitle>Modifica appartamento</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Codice</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Nome</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Nome appartamento"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
              <Select value={status} onValueChange={(v) => onStatusChange(v as ApartmentRow["status"])}>
                <SelectTrigger className="min-h-11 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Superficie (mq)</label>
              <Input
                type="number"
                min={0}
                step={1}
                className="min-h-11 rounded-lg border-border"
                value={surfaceMq}
                onChange={(e) => onSurfaceMqChange(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Annulla
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? "Salvataggio..." : "Salva"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
