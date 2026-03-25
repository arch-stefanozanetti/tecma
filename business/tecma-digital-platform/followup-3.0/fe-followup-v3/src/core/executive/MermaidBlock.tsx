import { useEffect, useId, useRef } from "react";

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

/**
 * Renderizza un blocco Mermaid (import dinamico della libreria al bisogno, init una sola volta).
 */
export function MermaidBlock({ chart }: { chart: string }) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className="my-4 overflow-x-auto rounded-lg border border-border bg-background p-4 [&_svg]:max-w-full"
      role="img"
      aria-label="Diagramma"
    />
  );
}
