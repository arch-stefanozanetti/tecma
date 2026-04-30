import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { statusLabel } from "./clientDetailConstants";
import { clientDisplayName } from "./ClientsPage.utils";
import type { ClientRow } from "../../types/domain";

export interface ClientDetailHeaderProps {
  client: ClientRow;
  onBack: () => void;
  onOpenEdit: () => void;
  loading?: boolean;
}

export default function ClientDetailHeader({ client, onBack, onOpenEdit, loading = false }: ClientDetailHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="min-h-11 gap-2" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-2"
          onClick={onOpenEdit}
          disabled={loading}
        >
          <Pencil className="h-4 w-4" />
          Modifica
        </Button>
      </div>

      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{clientDisplayName(client)}</h1>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              "bg-muted text-muted-foreground"
            )}
          >
            {statusLabel(client.status)}
          </span>
        </div>
      </header>
    </>
  );
}
