export type NormalizedChartPoint = { label: string; value: number };

export function normalizeChartData(
  tableData: Array<Record<string, unknown>>,
  chartSpec?: Record<string, unknown>
): NormalizedChartPoint[] {
  if (tableData.length === 0) return [];
  const headers = Object.keys(tableData[0] ?? {});
  const xKeyRaw = typeof chartSpec?.xKey === "string" ? chartSpec.xKey : "";
  const yKeyRaw = typeof chartSpec?.yKey === "string" ? chartSpec.yKey : "";
  const xKey = xKeyRaw && headers.includes(xKeyRaw) ? xKeyRaw : headers[0] ?? "";
  const yKey = yKeyRaw && headers.includes(yKeyRaw) ? yKeyRaw : headers.find((h) => h !== xKey) ?? "";
  if (!xKey || !yKey) return [];
  return tableData.map((row) => ({
    label: String(row[xKey] ?? "-"),
    value: Number(row[yKey] ?? 0),
  }));
}

