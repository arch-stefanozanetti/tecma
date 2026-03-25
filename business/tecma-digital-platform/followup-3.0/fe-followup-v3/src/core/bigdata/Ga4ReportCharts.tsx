/**
 * Chunk separato per Recharts: caricato con React.lazy dalla tab GA4.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatGa4Date(ymd: string): string {
  const d = ymd.trim();
  if (/^\d{8}$/.test(d)) {
    return `${d.slice(6, 8)}/${d.slice(4, 6)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  }
  return d;
}

const axisStroke = "hsl(var(--muted-foreground))";
const gridStroke = "hsl(var(--border))";
const linePrimary = "hsl(var(--primary))";
const lineMuted = "hsl(var(--foreground) / 0.45)";
const lineAccent = "hsl(var(--primary) / 0.55)";

export type Ga4ChartsTrendPoint = { date: string; sessions: number; activeUsers: number };
export type Ga4ChartsTrendUsersPoint = { date: string; newUsers: number; activeUsers: number };
export type Ga4ChartsLabelRow = { label: string; sessions: number };
export type Ga4ChartsFirstUserChannelRow = { channel: string; activeUsers: number; newUsers: number };
export type Ga4ChartsDeviceRow = { category: string; sessions: number; activeUsers: number };
export type Ga4ChartsAcquisitionRow = { sourceMedium: string; sessions: number; newUsers: number };
export type Ga4ChartsLandingRow = { path: string; sessions: number; activeUsers: number };

export function Ga4ChartsSection({
  trend,
  trendUsers,
  channels,
  firstUserChannels,
  devices = [],
  firstUserAcquisition = [],
  landingPages = [],
}: {
  trend: Ga4ChartsTrendPoint[];
  trendUsers: Ga4ChartsTrendUsersPoint[];
  channels: Ga4ChartsLabelRow[];
  firstUserChannels: Ga4ChartsFirstUserChannelRow[];
  devices?: Ga4ChartsDeviceRow[];
  firstUserAcquisition?: Ga4ChartsAcquisitionRow[];
  landingPages?: Ga4ChartsLandingRow[];
}) {
  const trendData = trend.map((t) => ({
    ...t,
    dateLabel: formatGa4Date(t.date),
  }));

  const trendUsersData = trendUsers.map((t) => ({
    ...t,
    dateLabel: formatGa4Date(t.date),
  }));

  const channelData = [...channels].sort((a, b) => b.sessions - a.sessions).slice(0, 10);

  const firstUserBarData = [...firstUserChannels]
    .sort((a, b) => b.activeUsers - a.activeUsers)
    .slice(0, 10)
    .map((c) => ({
      label: c.channel.length > 28 ? `${c.channel.slice(0, 26)}…` : c.channel,
      fullLabel: c.channel,
      activeUsers: c.activeUsers,
    }));

  const deviceBarData = [...devices]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8)
    .map((d) => ({
      label: d.category.length > 22 ? `${d.category.slice(0, 20)}…` : d.category,
      fullLabel: d.category,
      sessions: d.sessions,
    }));

  const acquisitionBarData = [...firstUserAcquisition]
    .sort((x, y) => y.sessions - x.sessions)
    .slice(0, 10)
    .map((row) => ({
      label: row.sourceMedium.length > 32 ? `${row.sourceMedium.slice(0, 30)}…` : row.sourceMedium,
      fullLabel: row.sourceMedium,
      sessions: row.sessions,
      newUsers: row.newUsers,
    }));

  const landingBarData = [...landingPages]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)
    .map((p) => ({
      label: p.path.length > 36 ? `${p.path.slice(0, 34)}…` : p.path,
      fullLabel: p.path,
      sessions: p.sessions,
    }));

  const tooltipBox = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    fontSize: "12px",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        className="rounded-lg border border-border bg-background/30 p-4"
        aria-label="Andamento sessioni nel periodo"
      >
        <h3 className="text-sm font-semibold text-foreground">Andamento sessioni</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sessioni e utenti attivi per giorno.</p>
        {trendData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato nel periodo per il trend giornaliero.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico: sessioni e utenti attivi nel tempo">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipBox}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("it-IT"),
                    name === "sessions" ? "Sessioni" : "Utenti attivi",
                  ]}
                />
                <Line type="monotone" dataKey="sessions" name="sessions" stroke={linePrimary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activeUsers" name="activeUsers" stroke={lineMuted} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background/30 p-4" aria-label="Andamento utenti">
        <h3 className="text-sm font-semibold text-foreground">Andamento utenti</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Nuovi utenti e utenti attivi per giorno.</p>
        {trendUsersData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato utenti nel periodo.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico: nuovi utenti e utenti attivi">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendUsersData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipBox}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("it-IT"),
                    name === "newUsers" ? "Nuovi utenti" : "Utenti attivi",
                  ]}
                />
                <Line type="monotone" dataKey="newUsers" name="newUsers" stroke={linePrimary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activeUsers" name="activeUsers" stroke={lineAccent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        className="rounded-lg border border-border bg-background/30 p-4"
        aria-label="Sessioni per canale di default della sessione"
      >
        <h3 className="text-sm font-semibold text-foreground">Canali (sessione)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sessioni per sessionDefaultChannelGroup.</p>
        {channelData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato canali sessione.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico a barre: canali di sessione">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={channelData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: axisStroke, fontSize: 10 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipBox}
                  formatter={(value: number) => [value.toLocaleString("it-IT"), "Sessioni"]}
                />
                <Bar dataKey="sessions" name="Sessioni" fill={linePrimary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        className="rounded-lg border border-border bg-background/30 p-4"
        aria-label="Utenti attivi per canale del primo accesso"
      >
        <h3 className="text-sm font-semibold text-foreground">Canali (primo utente)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Utenti attivi per firstUserDefaultChannelGroup.</p>
        {firstUserBarData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato canali primo utente.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico a barre: canale predefinito primo utente">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={firstUserBarData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: axisStroke, fontSize: 10 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipBox}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return p?.fullLabel ?? "";
                  }}
                  formatter={(value: number) => [value.toLocaleString("it-IT"), "Utenti attivi"]}
                />
                <Bar dataKey="activeUsers" name="Utenti attivi" fill={linePrimary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background/30 p-4" aria-label="Sessioni per dispositivo">
        <h3 className="text-sm font-semibold text-foreground">Dispositivo</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sessioni per deviceCategory.</p>
        {deviceBarData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato dispositivi.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico a barre: dispositivo">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={deviceBarData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fill: axisStroke, fontSize: 10 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipBox}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return p?.fullLabel ?? "";
                  }}
                  formatter={(value: number) => [value.toLocaleString("it-IT"), "Sessioni"]}
                />
                <Bar dataKey="sessions" name="Sessioni" fill={linePrimary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        className="rounded-lg border border-border bg-background/30 p-4"
        aria-label="Prima acquisizione source e medium"
      >
        <h3 className="text-sm font-semibold text-foreground">Prima acquisizione (source / medium)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sessioni e nuovi utenti per firstUserSource + firstUserMedium.</p>
        {acquisitionBarData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato prima acquisizione.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico a barre: prima acquisizione">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={acquisitionBarData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fill: axisStroke, fontSize: 9 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipBox}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return p?.fullLabel ?? "";
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("it-IT"),
                    name === "sessions" ? "Sessioni" : "Nuovi utenti",
                  ]}
                />
                <Bar dataKey="sessions" name="sessions" fill={linePrimary} radius={[0, 4, 4, 0]} />
                <Bar dataKey="newUsers" name="newUsers" fill={lineAccent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background/30 p-4" aria-label="Landing page con più sessioni">
        <h3 className="text-sm font-semibold text-foreground">Landing page</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sessioni per landingPage.</p>
        {landingBarData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nessun dato landing.</p>
        ) : (
          <div className="mt-3 h-64 w-full min-w-0" role="img" aria-label="Grafico a barre: landing page">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={landingBarData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fill: axisStroke, fontSize: 9 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipBox}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return p?.fullLabel ?? "";
                  }}
                  formatter={(value: number) => [value.toLocaleString("it-IT"), "Sessioni"]}
                />
                <Bar dataKey="sessions" name="Sessioni" fill={linePrimary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
