import { LayoutGrid, List } from "lucide-react";
import { cn } from "../../lib/utils";

export type ViewMode = "card" | "table";

interface ViewModeToggleProps {
  value: ViewMode;
  onValueChange: (v: ViewMode) => void;
  storageKey?: string;
  className?: string;
}

const STORAGE_PREFIX = "crm-view-mode-";

export function ViewModeToggle({ value, onValueChange, storageKey, className }: ViewModeToggleProps) {
  const handleChange = (v: ViewMode) => {
    onValueChange(v);
    if (storageKey) {
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, v);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className={cn("flex rounded-lg border border-border bg-muted/30 p-0.5", className)} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={value === "card"}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => handleChange("card")}
      >
        <LayoutGrid className="h-4 w-4" />
        Card
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => handleChange("table")}
      >
        <List className="h-4 w-4" />
        Tabella
      </button>
    </div>
  );
}

export function loadViewModeFromStorage(storageKey: string, fallback: ViewMode = "table"): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (v === "card" || v === "table") return v;
  } catch {
    // ignore
  }
  return fallback;
}
