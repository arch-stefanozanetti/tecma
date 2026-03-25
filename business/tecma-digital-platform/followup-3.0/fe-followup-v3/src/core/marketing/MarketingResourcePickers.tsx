/**
 * Selettori marketing stile Looker Studio: GA4 a due pannelli (Account | Proprietà),
 * Ads e Meta a lista singola con ricerca.
 */
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { groupGa4PropertiesByAccount } from "./groupGa4PropertiesByAccount";
import {
  adsOptionLabel,
  type AdsCustomerRow,
  type Ga4PropertyRow,
  type MetaAdAccountRow,
} from "./mergeDiscoveryWithSaved";

function filterByQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

function PaneSearchHeader({
  title,
  query,
  onQueryChange,
}: {
  title: string;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-2 py-2 sm:flex-row sm:items-center">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="h-8 pl-8 text-xs"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={`Cerca in ${title}`}
          placeholder="Cerca…"
        />
      </div>
    </div>
  );
}

const rowBase =
  "w-full rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MarketingAdsPicker({
  options,
  value,
  onChange,
  emptyHint,
  loadError,
  loadErrorHint,
  className,
}: {
  options: AdsCustomerRow[];
  value: string;
  onChange: (customerId: string) => void;
  emptyHint: string;
  loadError?: string | null;
  loadErrorHint?: string | null;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      options.filter((c) =>
        filterByQuery(`${adsOptionLabel(c)} ${c.customerId}`, q)
      ),
    [options, q]
  );

  const isEmpty = options.length === 0;

  if (loadError) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/5 dark:border-amber-400/30 dark:bg-amber-500/10",
          className
        )}
      >
        <div className="p-4 text-sm">
          <p className="font-medium text-foreground">{loadError}</p>
          {loadErrorHint ? (
            <p className="mt-2 leading-relaxed text-muted-foreground">{loadErrorHint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      <PaneSearchHeader title="Account Google Ads" query={q} onQueryChange={setQ} />
      <div
        className="max-h-56 overflow-y-auto p-1"
        role="listbox"
        aria-label="Account Google Ads"
      >
        {isEmpty ? (
          <p className="px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">{emptyHint}</p>
        ) : (
          filtered.map((c) => {
          const selected = c.customerId === value;
          return (
            <button
              key={`${c.resourceName}-${c.customerId}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(rowBase, selected && "border-primary/30 bg-primary/10")}
              onClick={() => onChange(c.customerId)}
            >
              <span className="block text-sm font-medium text-foreground">{adsOptionLabel(c)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Google Ads | {c.customerId}</span>
            </button>
          );
          })
        )}
        {!isEmpty && filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nessun risultato per la ricerca.</p>
        )}
      </div>
      {!isEmpty && (
        <div className="border-t border-border px-2 py-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange("")}
          >
            Nessun account Ads selezionato
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketingMetaPicker({
  options,
  value,
  onChange,
  emptyHint,
  className,
}: {
  options: MetaAdAccountRow[];
  value: string;
  onChange: (id: string) => void;
  emptyHint: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      options.filter((a) =>
        filterByQuery(`${a.name ?? ""} ${a.id} ${a.accountId}`, q)
      ),
    [options, q]
  );

  const isEmpty = options.length === 0;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      <PaneSearchHeader title="Account Meta" query={q} onQueryChange={setQ} />
      <div className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label="Account pubblicitario Meta">
        {isEmpty ? (
          <p className="px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">{emptyHint}</p>
        ) : (
          filtered.map((a) => {
          const selected = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(rowBase, selected && "border-primary/30 bg-primary/10")}
              onClick={() => onChange(a.id)}
            >
              <span className="block text-sm font-medium text-foreground">{a.name ?? a.id}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Meta | {a.id}</span>
            </button>
          );
          })
        )}
        {!isEmpty && filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nessun risultato per la ricerca.</p>
        )}
      </div>
      {!isEmpty && (
        <div className="border-t border-border px-2 py-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange("")}
          >
            Nessun account Meta selezionato
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketingGa4TwoPanePicker({
  properties,
  value,
  onChange,
  emptyHintAccounts,
  emptyHintProperties,
  loadError,
  loadErrorHint,
  className,
}: {
  properties: Ga4PropertyRow[];
  value: string;
  onChange: (propertyId: string) => void;
  /** Messaggio colonna Account quando l’API ha risposto OK ma non ci sono proprietà. */
  emptyHintAccounts: string;
  /** Messaggio colonna Proprietà nello stesso caso. */
  emptyHintProperties: string;
  /** Errore HTTP/backend (es. 424 GA4): sostituisce il layout finché presente. */
  loadError?: string | null;
  loadErrorHint?: string | null;
  className?: string;
}) {
  const groups = useMemo(() => groupGa4PropertiesByAccount(properties), [properties]);
  const [accountFocus, setAccountFocus] = useState<string | null>(null);
  const [qAccount, setQAccount] = useState("");
  const [qProperty, setQProperty] = useState("");

  const groupForValue = useMemo(() => {
    const v = value.trim();
    if (!v) return null;
    return groups.find((g) => g.properties.some((p) => p.propertyId === v)) ?? null;
  }, [value, groups]);

  useEffect(() => {
    setAccountFocus(null);
  }, [value]);

  const effectiveAccountKey =
    accountFocus ?? groupForValue?.accountKey ?? groups[0]?.accountKey ?? null;

  const activeGroup = groups.find((g) => g.accountKey === effectiveAccountKey) ?? null;

  const filteredAccounts = useMemo(
    () => groups.filter((g) => filterByQuery(g.accountLabel, qAccount)),
    [groups, qAccount]
  );

  const filteredProperties = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.properties.filter(
      (p) =>
        filterByQuery(`${p.displayName} ${p.propertyId}`, qProperty)
    );
  }, [activeGroup, qProperty]);

  const isEmpty = properties.length === 0;

  if (loadError) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/5 dark:border-amber-400/30 dark:bg-amber-500/10",
          className
        )}
      >
        <div className="p-4 text-sm">
          <p className="font-medium text-foreground">{loadError}</p>
          {loadErrorHint ? (
            <p className="mt-2 leading-relaxed text-muted-foreground">{loadErrorHint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      <div className="flex flex-col sm:flex-row">
        <div className="min-h-[12rem] flex-1 border-border sm:min-h-[14rem] sm:border-r">
          <PaneSearchHeader title="Account" query={qAccount} onQueryChange={setQAccount} />
          <div className="max-h-56 overflow-y-auto p-1 sm:max-h-64" role="listbox" aria-label="Account Google Analytics">
            {isEmpty ? (
              <p className="px-3 py-5 text-center text-sm leading-relaxed text-muted-foreground">{emptyHintAccounts}</p>
            ) : (
              filteredAccounts.map((g) => {
              const selected = g.accountKey === effectiveAccountKey;
              return (
                <button
                  key={g.accountKey}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(rowBase, selected && "border-primary/30 bg-primary/10")}
                  onClick={() => {
                    setAccountFocus(g.accountKey);
                    setQProperty("");
                  }}
                >
                  <span className="block text-sm font-medium text-foreground">{g.accountLabel}</span>
                </button>
              );
              })
            )}
            {!isEmpty && filteredAccounts.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nessun account corrisponde.</p>
            )}
          </div>
        </div>
        <div className="min-h-[12rem] flex-1 sm:min-h-[14rem]">
          <PaneSearchHeader title="Proprietà" query={qProperty} onQueryChange={setQProperty} />
          <div className="max-h-56 overflow-y-auto p-1 sm:max-h-64" role="listbox" aria-label="Proprietà GA4">
            {isEmpty ? (
              <p className="px-3 py-5 text-center text-sm leading-relaxed text-muted-foreground">{emptyHintProperties}</p>
            ) : (
              <>
                {activeGroup &&
                  filteredProperties.map((p) => {
                    const selected = p.propertyId === value;
                    return (
                      <button
                        key={p.propertyId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(rowBase, selected && "border-primary/30 bg-primary/10")}
                        onClick={() => onChange(p.propertyId)}
                      >
                        <span className="block text-sm font-medium text-foreground">{p.displayName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">GA4 | {p.propertyId}</span>
                      </button>
                    );
                  })}
                {activeGroup && filteredProperties.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nessuna proprietà corrisponde.</p>
                )}
                {!activeGroup && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Seleziona un account a sinistra.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {!isEmpty && (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange("")}
          >
            Nessuna proprietà GA4 selezionata
          </button>
        </div>
      )}
    </div>
  );
}
