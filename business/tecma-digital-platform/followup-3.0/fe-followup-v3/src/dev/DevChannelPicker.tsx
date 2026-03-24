import { useEffect, useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  buildChannelSwitchHref,
  devChannelsManifestUrl,
  isDevChannelPickerEnabled,
  viteBasePrefix,
} from "./devChannelPaths";
import { fetchDevChannels } from "./fetchDevChannels";
import type { DevChannelEntry } from "./devChannelTypes";
import { DEV_CHANNEL_API_OVERRIDE_KEY } from "./devChannelStorage";

function switchToChannel(channel: DevChannelEntry): void {
  if (typeof window === "undefined") return;
  const currentPrefix = viteBasePrefix(import.meta.env.BASE_URL);
  const href = buildChannelSwitchHref(
    channel.basePath,
    window.location.pathname,
    window.location.search,
    window.location.hash,
    currentPrefix
  );
  try {
    if (channel.apiBaseUrlOverride) {
      window.sessionStorage.setItem(DEV_CHANNEL_API_OVERRIDE_KEY, channel.apiBaseUrlOverride);
    } else {
      window.sessionStorage.removeItem(DEV_CHANNEL_API_OVERRIDE_KEY);
    }
  } catch {
    // ignore
  }
  window.location.assign(href);
}

type DevChannelPickerProps = {
  /** Layout compatto (es. header app) */
  compact?: boolean;
  className?: string;
};

export function DevChannelPicker({ compact, className }: DevChannelPickerProps) {
  const [channels, setChannels] = useState<DevChannelEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manifestUrl = useMemo(() => devChannelsManifestUrl(), []);

  useEffect(() => {
    let cancelled = false;
    fetchDevChannels(manifestUrl)
      .then((list) => {
        if (!cancelled) {
          setChannels(list);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setChannels([]);
          setError(e instanceof Error ? e.message : "Impossibile caricare i canali");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  const currentPrefix = viteBasePrefix(import.meta.env.BASE_URL);
  const currentId = useMemo(() => {
    if (!channels || channels.length === 0) return "";
    const normalizedCurrent = currentPrefix === "" ? "/" : currentPrefix;
    for (const ch of channels) {
      const p = ch.basePath.trim().replace(/\/$/, "") || "/";
      if (p === normalizedCurrent) return ch.id;
    }
    return "";
  }, [channels, currentPrefix]);

  if (!isDevChannelPickerEnabled()) return null;

  if (channels === null) {
    return (
      <div className={className} title="Caricamento canali…">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          Canali…
        </span>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className={className} title={error ?? "Nessun canale nel manifest"}>
        <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-xs text-amber-700 dark:text-amber-400">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          {error ? "Manifest canali" : "Nessun canale"}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="followup-dev-channel-select">
        Canale build dev-1
      </label>
      <Select
        value={currentId || channels[0].id}
        onValueChange={(id) => {
          const ch = channels.find((c) => c.id === id);
          if (ch) switchToChannel(ch);
        }}
      >
        <SelectTrigger
          id="followup-dev-channel-select"
          className={
            compact
              ? "h-9 min-h-9 max-w-[200px] gap-1 border-amber-600/40 bg-amber-50 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
              : "h-11 min-h-11 max-w-full gap-2 border-amber-600/40 bg-amber-50 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
          }
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <SelectValue placeholder="Canale" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((ch) => (
            <SelectItem key={ch.id} value={ch.id} title={`${ch.gitBranch}: ${ch.description}`}>
              <span className="font-medium">{ch.label}</span>
              <span className="block text-[11px] text-muted-foreground">{ch.gitBranch}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
