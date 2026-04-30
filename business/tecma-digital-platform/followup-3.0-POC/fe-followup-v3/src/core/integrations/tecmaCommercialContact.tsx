import type { ReactNode } from "react";

/** URL o `mailto:` configurabile (es. pagina contatti Tecma). */
export function getTecmaCommercialContactUrl(): string | undefined {
  const raw = import.meta.env.VITE_TECMA_COMMERCIAL_CONTACT_URL;
  const u = typeof raw === "string" ? raw.trim() : "";
  return u || undefined;
}

export function getTecmaCommercialContactLabel(): string {
  const raw = import.meta.env.VITE_TECMA_COMMERCIAL_CONTACT_LABEL;
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || "Contatta Tecma";
}

/** Spazio + link opzionale per appendere a copy già presente. */
export function commercialContactInlineNode(): ReactNode {
  const url = getTecmaCommercialContactUrl();
  if (!url) return null;
  const label = getTecmaCommercialContactLabel();
  const external = !url.startsWith("mailto:");
  return (
    <>
      {" "}
      <a
        href={url}
        className="font-medium text-foreground underline underline-offset-2"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    </>
  );
}
