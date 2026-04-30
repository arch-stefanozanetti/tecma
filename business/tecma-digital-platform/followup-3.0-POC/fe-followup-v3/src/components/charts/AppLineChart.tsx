import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTheme } from "./chartTheme";

export function AppLineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <div className="h-80 border-b border-border px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray={chartTheme.gridDash} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: chartTheme.axisTickFontSize }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={chartTheme.xAxisHeight}
          />
          <YAxis tick={{ fontSize: chartTheme.axisTickFontSize }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={chartTheme.strokePrimary} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

