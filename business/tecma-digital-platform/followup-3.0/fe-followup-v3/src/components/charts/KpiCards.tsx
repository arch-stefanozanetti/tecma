export function KpiCards({
  rows,
}: {
  rows: Array<{ metric: string; value: number; unit: string }>;
}) {
  return (
    <div className="grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((card) => (
        <div key={card.metric} className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.metric.replace(/_/g, " ")}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {card.value}
            {card.unit === "percent" ? "%" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

