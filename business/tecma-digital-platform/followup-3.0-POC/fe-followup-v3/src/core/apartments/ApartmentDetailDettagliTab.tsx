import type { ReactNode } from "react";
import { formatDate } from "../../lib/formatDate";
import { ApartmentDetailAssignmentsSection } from "./ApartmentDetailAssignmentsSection";
import type { ApartmentRow } from "../../types/domain";

const EXTRA_INFO_LABELS: Record<string, string> = {
  legacyNote: "Note",
  planimetryUrls: "Altre planimetrie (URL)",
  additionalPlanimetryUrls: "Planimetrie aggiuntive",
};

function formatExtraInfoKey(key: string): string {
  if (EXTRA_INFO_LABELS[key]) return EXTRA_INFO_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

function renderExtraInfoValue(key: string, value: unknown): ReactNode {
  if (value == null || value === "") return null;
  if (key === "planimetryUrls" || key === "additionalPlanimetryUrls") {
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return (
        <ul className="list-inside list-disc space-y-1 text-sm">
          {(value as string[]).map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">
                {u}
              </a>
            </li>
          ))}
        </ul>
      );
    }
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
  }
  if (typeof value === "object") {
    return (
      <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-muted/50 p-2 text-xs font-mono whitespace-pre-wrap break-all text-foreground/90">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

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
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {Object.entries(apartment.extraInfo).map(([key, value]) => {
              const rendered = renderExtraInfoValue(key, value);
              if (rendered == null) return null;
              return (
                <div key={key} className="min-w-0 sm:col-span-2">
                  <span className="text-muted-foreground">{formatExtraInfoKey(key)}</span>
                  <div className="mt-1 font-medium text-foreground">{rendered}</div>
                </div>
              );
            })}
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
