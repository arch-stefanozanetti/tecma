import { Progress } from "../../components/ui/progress";
import { getProfilationPercent } from "./clientDetailConstants";
import type { ClientRow } from "../../types/domain";

interface ClientProfilationCardProps {
  client: ClientRow | null;
}

/** Card che mostra la percentuale di profilazione (campi compilati per il match). */
export function ClientProfilationCard({ client }: ClientProfilationCardProps) {
  const percent = client ? getProfilationPercent(client) : 0;
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Profilazione per il match</h2>
      <p className="text-xs text-muted-foreground">
        Più il profilo è completo, più i consigli di appartamenti saranno pertinenti.
      </p>
      <Progress value={percent} showLabel className="h-2" />
      {percent < 100 && (
        <p className="text-xs text-muted-foreground">
          Completa email, telefono, città, fonte e altri campi per migliorare il match.
        </p>
      )}
    </section>
  );
}
