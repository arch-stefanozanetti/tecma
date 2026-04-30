import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export interface ApartmentDetailAssignmentsSectionProps {
  assignments: Array<{ userId: string }>;
  workspaceUsers: Array<{ userId: string }>;
  assignUserId: string;
  onAssignUserIdChange: (v: string) => void;
  onAssign: () => void;
  onUnassign: (userId: string) => void;
}

export function ApartmentDetailAssignmentsSection({
  assignments,
  workspaceUsers,
  assignUserId,
  onAssignUserIdChange,
  onAssign,
  onUnassign,
}: ApartmentDetailAssignmentsSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        Assegnato a
      </h2>
      <p className="text-xs text-muted-foreground mb-2">
        Assegna questo appartamento a un vendor per limitarne la visibilità.
      </p>
      <ul className="space-y-1 mb-3">
        {assignments.map((a) => (
          <li key={a.userId} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span>{a.userId}</span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 text-muted-foreground hover:text-destructive"
              onClick={() => onUnassign(a.userId)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
        {assignments.length === 0 && <li className="text-sm text-muted-foreground">Nessuna assegnazione</li>}
      </ul>
      <div className="flex gap-2">
        <Select value={assignUserId} onValueChange={onAssignUserIdChange}>
          <SelectTrigger className="min-h-11 flex-1 max-w-xs">
            <SelectValue placeholder="Seleziona utente" />
          </SelectTrigger>
          <SelectContent>
            {workspaceUsers
              .filter((u) => !assignments.some((a) => a.userId === u.userId))
              .map((u) => (
                <SelectItem key={u.userId} value={u.userId}>
                  {u.userId}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onAssign} disabled={!assignUserId.trim()}>
          Assegna
        </Button>
      </div>
    </section>
  );
}
