import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from "lucide-react";
import type { ApartmentRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

/** Raccoglie URL planimetria: campo principale + eventuali liste in `extraInfo`. */
export function collectPlanimetryUrls(apartment: ApartmentRow): string[] {
  const urls: string[] = [];
  const add = (u: unknown) => {
    if (typeof u !== "string") return;
    const t = u.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) urls.push(t);
  };

  add(apartment.planimetryUrl);

  const ex = apartment.extraInfo;
  if (ex?.planimetryUrls && Array.isArray(ex.planimetryUrls)) {
    for (const u of ex.planimetryUrls) add(u);
  }
  if (ex?.additionalPlanimetryUrls && Array.isArray(ex.additionalPlanimetryUrls)) {
    for (const u of ex.additionalPlanimetryUrls) add(u);
  }

  return [...new Set(urls)];
}

export interface ApartmentPlanimetryGalleryProps {
  apartment: ApartmentRow;
  /** Apre il drawer modifica (es. per aggiungere URL). */
  onEditPlanimetry?: () => void;
  className?: string;
}

export function ApartmentPlanimetryGallery({
  apartment,
  onEditPlanimetry,
  className,
}: ApartmentPlanimetryGalleryProps): JSX.Element {
  const urls = useMemo(() => collectPlanimetryUrls(apartment), [apartment]);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIndex(0);
    setLoadError(false);
  }, [apartment._id, apartment.planimetryUrl, apartment.extraInfo]);

  const current = urls[index];
  const hasMany = urls.length > 1;

  const goPrev = useCallback(() => {
    setLoadError(false);
    setIndex((i) => (i <= 0 ? urls.length - 1 : i - 1));
  }, [urls.length]);

  const goNext = useCallback(() => {
    setLoadError(false);
    setIndex((i) => (i >= urls.length - 1 ? 0 : i + 1));
  }, [urls.length]);

  const title = apartment.name?.trim() || apartment.code || "Unità";

  if (urls.length === 0) {
    return (
      <section
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center",
          className
        )}
        aria-label="Planimetrie"
      >
        <ImageOff className="mx-auto h-10 w-10 text-muted-foreground opacity-70" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">Nessuna planimetria caricata</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aggiungi un URL planimetria nelle impostazioni dell&apos;appartamento per visualizzarla qui.
        </p>
        {onEditPlanimetry && (
          <Button type="button" variant="outline" size="sm" className="mt-4 min-h-11" onClick={onEditPlanimetry}>
            Aggiungi planimetria
          </Button>
        )}
      </section>
    );
  }

  return (
    <section
      className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}
      aria-label={`Planimetrie — ${title}`}
    >
      <div className="relative aspect-[4/3] w-full bg-muted/40 sm:aspect-[16/9]">
        {!loadError && current ? (
          <img
            src={current}
            alt={`Planimetria ${index + 1} di ${urls.length} — ${title}`}
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setLoadError(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Impossibile caricare l&apos;immagine.</p>
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-2"
            >
              Apri link
            </a>
          </div>
        )}

        {hasMany && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full shadow-md"
              onClick={goPrev}
              aria-label="Planimetria precedente"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full shadow-md"
              onClick={goNext}
              aria-label="Planimetria successiva"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          {urls.length > 1 ? (
            <>
              Planimetria <span className="font-medium text-foreground">{index + 1}</span> di{" "}
              <span className="font-medium text-foreground">{urls.length}</span>
            </>
          ) : (
            "Planimetria"
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {current && (
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Apri originale
            </a>
          )}
          {onEditPlanimetry && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onEditPlanimetry}>
              Modifica URL
            </Button>
          )}
        </div>
      </div>

      {hasMany && (
        <div className="flex justify-center gap-1.5 border-t border-border px-3 py-2" role="tablist" aria-label="Seleziona planimetria">
          {urls.map((u, i) => (
            <button
              key={u}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Vai alla planimetria ${i + 1}`}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"
              )}
              onClick={() => {
                setLoadError(false);
                setIndex(i);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
