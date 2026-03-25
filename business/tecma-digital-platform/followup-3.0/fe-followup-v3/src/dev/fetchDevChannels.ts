import type { DevChannelEntry } from "./devChannelTypes";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEntry(raw: unknown): DevChannelEntry | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const gitBranch = typeof raw.gitBranch === "string" ? raw.gitBranch.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const basePath = typeof raw.basePath === "string" ? raw.basePath.trim() : "";
  if (!id || !label || !basePath) return null;
  const apiBaseUrlOverride =
    typeof raw.apiBaseUrlOverride === "string" && raw.apiBaseUrlOverride.trim() !== ""
      ? raw.apiBaseUrlOverride.trim()
      : undefined;
  return {
    id,
    gitBranch: gitBranch || id,
    label,
    description: description || label,
    basePath,
    apiBaseUrlOverride,
  };
}

export async function fetchDevChannels(manifestUrl: string): Promise<DevChannelEntry[]> {
  const res = await fetch(manifestUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`channels manifest HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("channels manifest: atteso array JSON");
  const out: DevChannelEntry[] = [];
  for (const item of json) {
    const parsed = parseEntry(item);
    if (parsed) out.push(parsed);
  }
  return out;
}
