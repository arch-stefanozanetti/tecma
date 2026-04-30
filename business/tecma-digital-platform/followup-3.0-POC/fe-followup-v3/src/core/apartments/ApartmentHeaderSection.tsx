import type { ReactNode } from "react";
import { ArrowLeft, Pencil, Settings2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { STATUS_LABEL, MODE_LABEL } from "./apartmentDetailConstants";
import type { ApartmentRow } from "../../types/domain";

interface ApartmentHeaderSectionProps {
  apartment: ApartmentRow | null;
  onBack: () => void;
  onEdit?: () => void;
  onEditHC?: () => void;
  rightContent?: ReactNode;
  className?: string;
}

/** Intestazione pagina dettaglio appartamento: pulsante indietro, nome, stato e modalità, azioni opzionali. */
export function ApartmentHeaderSection({
  apartment,
  onBack,
  onEdit,
  onEditHC,
  rightContent,
  className,
}: ApartmentHeaderSectionProps) {
  if (!apartment) return null;
  return (
    <>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
        <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Appartamenti
        </Button>
        {(rightContent ?? onEdit ?? onEditHC) && (
          <div className="flex gap-2">
            {rightContent}
            {onEdit && (
              <Button variant="outline" size="sm" className="gap-2" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            )}
            {onEditHC && (
              <Button variant="outline" size="sm" className="gap-2" onClick={onEditHC}>
                <Settings2 className="h-4 w-4" />
                Configura HC
              </Button>
            )}
          </div>
        )}
      </div>
      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{apartment.name || apartment.code}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {STATUS_LABEL[apartment.status]}
            </span>
            <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {MODE_LABEL[apartment.mode]}
            </span>
          </div>
          {apartment.name && apartment.code !== apartment.name && (
            <p className="mt-1 text-sm text-muted-foreground">Codice: {apartment.code}</p>
          )}
        </div>
      </header>
    </>
  );
}
