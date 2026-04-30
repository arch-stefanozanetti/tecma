import { lazy, Suspense } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { COIMA_GANTT_JOURNEY, COIMA_GANTT_ROADMAP } from "./coimaData";

const MermaidBlockLazy = lazy(() =>
  import("../executive/MermaidBlock").then((module) => ({ default: module.MermaidBlock }))
);

export function CoimaVisualTab({
  barData,
  pieData,
  total,
}: {
  barData: Array<{ name: string; si: number; parziale: number; no: number }>;
  pieData: Array<{ name: string; value: number; fill: string }>;
  total: number;
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Copertura per fase</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={barData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="si" stackId="a" fill="#22c55e" name="Sì" />
                <Bar dataKey="parziale" stackId="a" fill="#f59e0b" name="Parziale" />
                <Bar dataKey="no" stackId="a" fill="#ef4444" name="No" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuzione globale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {pieData.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const n = typeof value === "number" ? value : Number(value);
                    const pct = total ? ((n / total) * 100).toFixed(1) : "0";
                    return [`${n} (${pct}%)`, String(name ?? "")];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gantt percorso cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">Caricamento diagramma…</div>}>
            <MermaidBlockLazy chart={COIMA_GANTT_JOURNEY} zoomable />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Gantt roadmap FASE</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">Caricamento diagramma…</div>}>
            <MermaidBlockLazy chart={COIMA_GANTT_ROADMAP} zoomable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
