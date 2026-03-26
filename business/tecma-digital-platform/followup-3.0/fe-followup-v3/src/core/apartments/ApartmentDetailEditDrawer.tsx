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
  floor: string;
  onFloorChange: (v: string) => void;
  typologyName: string;
  onTypologyNameChange: (v: string) => void;
  rooms: string;
  onRoomsChange: (v: string) => void;
  bedrooms: string;
  onBedroomsChange: (v: string) => void;
  bathrooms: string;
  onBathroomsChange: (v: string) => void;
  tags: string;
  onTagsChange: (v: string) => void;
  planimetryUrl: string;
  onPlanimetryUrlChange: (v: string) => void;
  additionalPlanimetryUrls: string;
  onAdditionalPlanimetryUrlsChange: (v: string) => void;
  extraNote: string;
  onExtraNoteChange: (v: string) => void;
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
  floor,
  onFloorChange,
  typologyName,
  onTypologyNameChange,
  rooms,
  onRoomsChange,
  bedrooms,
  onBedroomsChange,
  bathrooms,
  onBathroomsChange,
  tags,
  onTagsChange,
  planimetryUrl,
  onPlanimetryUrlChange,
  additionalPlanimetryUrls,
  onAdditionalPlanimetryUrlsChange,
  extraNote,
  onExtraNoteChange,
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Piano</label>
              <Input
                type="number"
                className="min-h-11 rounded-lg border-border"
                value={floor}
                onChange={(e) => onFloorChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tipologia (legacy plan)</label>
              <Input className="min-h-11 rounded-lg border-border" value={typologyName} onChange={(e) => onTypologyNameChange(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" className="min-h-11 rounded-lg border-border" value={rooms} onChange={(e) => onRoomsChange(e.target.value)} placeholder="Vani" />
              <Input type="number" className="min-h-11 rounded-lg border-border" value={bedrooms} onChange={(e) => onBedroomsChange(e.target.value)} placeholder="Camere" />
              <Input type="number" className="min-h-11 rounded-lg border-border" value={bathrooms} onChange={(e) => onBathroomsChange(e.target.value)} placeholder="Bagni" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tag (separati da virgola)</label>
              <Input className="min-h-11 rounded-lg border-border" value={tags} onChange={(e) => onTagsChange(e.target.value)} placeholder="vista mare, premium" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">URL planimetria principale</label>
              <Input
                type="url"
                className="min-h-11 rounded-lg border-border"
                value={planimetryUrl}
                onChange={(e) => onPlanimetryUrlChange(e.target.value)}
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-muted-foreground">Obbligatorio in fase di creazione; lascia vuoto per non modificare l&apos;URL già salvato.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Altre planimetrie (URL)</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={additionalPlanimetryUrls}
                onChange={(e) => onAdditionalPlanimetryUrlsChange(e.target.value)}
                placeholder="https://..., https://..."
              />
              <p className="mt-1 text-xs text-muted-foreground">Separati da virgola; compaiono nella galleria in Panoramica.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Nota extra info</label>
              <Input className="min-h-11 rounded-lg border-border" value={extraNote} onChange={(e) => onExtraNoteChange(e.target.value)} placeholder="Informazione legacy aggiuntiva" />
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
