import { Link } from "react-router-dom";

export interface MatchingCandidate<T extends { _id: string }> {
  item: T;
  score: number;
  reasons: string[];
}

interface MatchingCandidatesListProps<T extends { _id: string }> {
  title: string;
  introText: string;
  emptyMessage: string;
  loading: boolean;
  candidates: MatchingCandidate<T>[];
  getItemLink: (item: T) => string;
  renderItemTitle: (item: T) => React.ReactNode;
  renderItemSubtitle?: (item: T) => React.ReactNode;
}

export function MatchingCandidatesList<T extends { _id: string }>({
  title,
  introText,
  emptyMessage,
  loading,
  candidates,
  getItemLink,
  renderItemTitle,
  renderItemSubtitle,
}: MatchingCandidatesListProps<T>) {
  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-xs text-muted-foreground mb-3">{introText}</p>
        <p className="text-sm text-muted-foreground">Calcolo in corso...</p>
      </section>
    );
  }

  if (candidates.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-xs text-muted-foreground mb-3">{introText}</p>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {introText} Lo score (0–100) indica l’affinità; sotto ogni candidato trovi il motivo per cui è stato suggerito.
      </p>
      <ul className="space-y-4">
        {candidates.map(({ item, score, reasons }) => (
          <li
            key={item._id}
            className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-start gap-4"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {score}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to={getItemLink(item)}
                  className="font-medium text-primary hover:underline"
                >
                  {renderItemTitle(item)}
                </Link>
                {renderItemSubtitle && (
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {renderItemSubtitle(item)}
                  </div>
                )}
              </div>
            </div>
            {reasons.length > 0 && (
              <div className="sm:w-64 shrink-0">
                <p className="text-xs font-medium text-foreground mb-1.5">Perché è stato suggerito</p>
                <ul className="space-y-1">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
