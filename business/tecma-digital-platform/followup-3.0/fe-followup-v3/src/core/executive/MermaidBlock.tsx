import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;

function appendSvgString(container: HTMLDivElement, svg: string) {
  container.replaceChildren();
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.querySelector("parsererror")) {
    container.textContent = "Errore nel parsing del diagramma.";
    return;
  }
  container.appendChild(document.importNode(root, true));
}

async function getMermaidSingleton() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "neutral",
      });
      return mermaid;
    })();
  }
  return mermaidInitPromise;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export interface MermaidBlockProps {
  chart: string;
  /** Zoom (Ctrl/⌘ + rotella), pan (trascina), controlli +/- e reset. */
  zoomable?: boolean;
  className?: string;
}

/**
 * Renderizza un blocco Mermaid (import dinamico della libreria al bisogno, init una sola volta).
 * Con `zoomable` il contenuto SVG è in un viewport con trasformazione: utile per Gantt larghi.
 */
export function MermaidBlock({ chart, zoomable = false, className }: MermaidBlockProps) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (zoomable) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [chart, zoomable]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const mermaid = await getMermaidSingleton();
      const renderId = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await mermaid.render(renderId, chart);
        if (cancelled || !containerRef.current) return;
        appendSvgString(containerRef.current, svg);
      } catch (e) {
        if (!cancelled && containerRef.current) {
          containerRef.current.replaceChildren();
          containerRef.current.textContent = e instanceof Error ? e.message : String(e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setScale((s) => clamp(s * factor, 0.25, 4));
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!zoomable) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.08 : 0.93;
        setScale((s) => clamp(s * delta, 0.25, 4));
      }
    },
    [zoomable]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!zoomable) return;
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pan.x,
        originY: pan.y,
      };
    },
    [zoomable, pan.x, pan.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d?.active || e.pointerId !== d.pointerId) return;
    setPan({
      x: d.originX + (e.clientX - d.startX),
      y: d.originY + (e.clientY - d.startY),
    });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && e.pointerId === d.pointerId) {
      dragRef.current = null;
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!zoomable) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(1.15);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / 1.15);
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetView();
      }
    },
    [zoomable, zoomBy, resetView]
  );

  const diagramInner = (
    <div
      ref={containerRef}
      className={cn(
        "rounded-lg border border-border bg-background p-4 [&_svg]:max-h-none [&_svg]:max-w-none [&_svg]:min-w-0",
        !zoomable && "my-4 overflow-x-auto [&_svg]:max-w-full"
      )}
      role="img"
      aria-label="Diagramma"
    />
  );

  if (!zoomable) {
    return <div className={className}>{diagramInner}</div>;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="absolute right-1 top-1 z-10 flex gap-1 rounded-md border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-sm">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1.2)} aria-label="Zoom avanti">
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom indietro">
          <Minus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} aria-label="Reimposta vista">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={viewportRef}
        role="application"
        aria-label="Diagramma zoomabile: Ctrl e rotella per zoom, trascina per spostare"
        tabIndex={0}
        className="relative h-[min(420px,70vh)] min-h-[200px] overflow-hidden rounded-lg border border-border bg-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={resetView}
        style={{ touchAction: "none" }}
      >
        <div
          className="inline-block cursor-grab select-none active:cursor-grabbing"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {diagramInner}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Zoom:</strong> Ctrl/⌘ + rotella, oppure pulsanti +/− · <strong className="font-medium text-foreground">Sposta:</strong> trascina ·{" "}
        <strong className="font-medium text-foreground">Reset:</strong> doppio clic nell’area o pulsante ↺
      </p>
    </div>
  );
}
