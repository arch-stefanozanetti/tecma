import { formatDate } from "../../lib/formatDate";
import { ApartmentDetailAssignmentsSection } from "./ApartmentDetailAssignmentsSection";
import type { ApartmentRow } from "../../types/domain";

export interface ApartmentDetailDettagliTabProps {
  apartment: ApartmentRow;
  isAdmin: boolean;
  assignments: Array<{ userId: string }>;
  workspaceUsers: Array<{ userId: string }>;
  assignUserId: string;
  onAssignUserIdChange: (v: string) => void;
  onAssign: () => void;
  onUnassign: (userId: string) => void;
}

export function ApartmentDetailDettagliTab({
  apartment,
  isAdmin,
  assignments,
  workspaceUsers,
  assignUserId,
  onAssignUserIdChange,
  onAssign,
  onUnassign,
}: ApartmentDetailDettagliTabProps) {
  return (
    <>
      {apartment.extraInfo && Object.keys(apartment.extraInfo).length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Info aggiuntive</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(apartment.extraInfo).map(([key, value]) =>
              value != null && value !== "" ? (
                <div key={key}>
                  <span className="text-muted-foreground">{key}</span>
                  <p className="font-medium text-foreground">{String(value)}</p>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Date e dettagli tecnici</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Aggiornato il</span>
            <p className="font-medium text-foreground">{formatDate(apartment.updatedAt)}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">ID</span>
            <p className="font-mono text-xs text-foreground">{apartment._id}</p>
          </div>
        </div>
      </section>
      {isAdmin && (
        <ApartmentDetailAssignmentsSection
          assignments={assignments}
          workspaceUsers={workspaceUsers}
          assignUserId={assignUserId}
          onAssignUserIdChange={onAssignUserIdChange}
          onAssign={onAssign}
          onUnassign={onUnassign}
        />
      )}
    </>
  );
}
