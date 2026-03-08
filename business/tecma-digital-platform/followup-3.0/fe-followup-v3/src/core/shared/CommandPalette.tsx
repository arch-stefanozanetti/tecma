import { useEffect, useMemo, useState } from "react";
import { Input } from "../../components/ui/input";
import { isSectionEnabledByFeature } from "../features";

type Section =
  | "cockpit"
  | "calendar"
  | "clients"
  | "apartments"
  | "requests"
  | "workspaces"
  | "audit"
  | "reports"
  | "releases";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: Section) => void;
  /** Feature abilitate per il workspace (undefined = tutte). Nasconde comandi non abilitati. */
  enabledFeatures?: string[];
}

const commands: Array<{ id: Section; label: string; hint: string }> = [
  { id: "cockpit", label: "Home", hint: "Cockpit e priorità" },
  { id: "clients", label: "Clienti", hint: "Lista clienti" },
  { id: "apartments", label: "Appartamenti", hint: "Lista appartamenti" },
  { id: "requests", label: "Trattative", hint: "Pipeline vendita/affitto" },
  { id: "calendar", label: "Calendario", hint: "Agenda" },
  { id: "workspaces", label: "Workspaces", hint: "Gestione workspace (admin)" },
  { id: "audit", label: "Audit log", hint: "Tracciamento CRUD (admin)" },
  { id: "reports", label: "Report", hint: "Pipeline, clienti, appartamenti" },
  { id: "releases", label: "Release", hint: "Novità e cronologia release" },
];

export const CommandPalette = ({ isOpen, onClose, onSelectSection, enabledFeatures }: CommandPaletteProps) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const visibleCommands = useMemo(
    () => commands.filter((item) => isSectionEnabledByFeature(item.id, enabledFeatures)),
    [enabledFeatures]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleCommands;
    return visibleCommands.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(needle));
  }, [query, visibleCommands]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(event) => event.stopPropagation()}>
        <Input
          placeholder="Digita un comando... (Ctrl/Cmd + K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full"
        />
        <div className="command-list">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="command-item"
              onClick={() => {
                onSelectSection(item.id);
                onClose();
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="generic-table-feedback">Nessun comando trovato.</p>}
        </div>
      </div>
    </div>
  );
};
