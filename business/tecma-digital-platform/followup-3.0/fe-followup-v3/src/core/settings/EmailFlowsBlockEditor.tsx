/**
 * Editor a blocchi per email transazionali: logo, colore, titolo/testo/pulsante/immagine.
 * I placeholder si inseriscono solo trascinando dalla palette (testo {{var}}).
 */
import { useCallback, useRef } from "react";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../contexts/ToastContext";

export type EmailLayoutBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "button"; label: string; href: string }
  | { type: "image"; src: string; alt: string };

export type EmailLayoutState = {
  logoUrl: string;
  primaryColor: string;
  blocks: EmailLayoutBlock[];
};

function insertAtCursor(value: string, insert: string, start: number, end: number): { next: string; caret: number } {
  const next = value.slice(0, start) + insert + value.slice(end);
  return { next, caret: start + insert.length };
}

function DroppableField({
  value,
  onChange,
  multiline,
  placeholder,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;
      const el = ref.current;
      if (!el) return;
      const start = "selectionStart" in el && el.selectionStart != null ? el.selectionStart : value.length;
      const end = "selectionEnd" in el && el.selectionEnd != null ? el.selectionEnd : value.length;
      const { next, caret } = insertAtCursor(value, text, start, end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        if ("setSelectionRange" in el) el.setSelectionRange(caret, caret);
      });
    },
    [value, onChange]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const common = {
    ref: ref as never,
    value,
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(ev.target.value),
    onDrop,
    onDragOver,
    placeholder,
    className: `${className ?? ""} border-dashed border-border/80`,
    spellCheck: false as const
  };

  return multiline ? <Textarea {...common} rows={4} /> : <Input {...common} />;
}

export function defaultEmailLayout(flowKey: string): EmailLayoutState {
  const link =
    flowKey === "user_invite"
      ? "{{inviteLink}}"
      : flowKey === "password_reset"
        ? "{{resetLink}}"
        : "{{verifyLink}}";
  return {
    logoUrl: "",
    primaryColor: "#1a1a2e",
    blocks: [
      { type: "heading", text: "Titolo" },
      { type: "text", text: "Testo del messaggio." },
      { type: "button", label: "Azione", href: link }
    ]
  };
}

export function EmailFlowsBlockEditor({
  flowKey,
  placeholders,
  layout,
  onChange
}: {
  flowKey: string;
  placeholders: string[];
  layout: EmailLayoutState;
  onChange: (l: EmailLayoutState) => void;
}) {
  const { toastError } = useToast();
  const fileLogo = useRef<HTMLInputElement>(null);

  const setBlock = (i: number, patch: Partial<EmailLayoutBlock>) => {
    const blocks = layout.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) as EmailLayoutBlock[];
    onChange({ ...layout, blocks });
  };

  const addBlock = (type: EmailLayoutBlock["type"]) => {
    const link =
      flowKey === "user_invite"
        ? "{{inviteLink}}"
        : flowKey === "password_reset"
          ? "{{resetLink}}"
          : "{{verifyLink}}";
    const next: EmailLayoutBlock =
      type === "heading"
        ? { type: "heading", text: "Titolo" }
        : type === "text"
          ? { type: "text", text: "" }
          : type === "button"
            ? { type: "button", label: "Pulsante", href: link }
            : { type: "image", src: "", alt: "" };
    onChange({ ...layout, blocks: [...layout.blocks, next] });
  };

  const removeBlock = (i: number) => {
    if (layout.blocks.length <= 1) return;
    onChange({ ...layout, blocks: layout.blocks.filter((_, j) => j !== i) });
  };

  const uploadFile = async (file: File, kind: "logo" | "image", blockIndex?: number) => {
    try {
      const { url } = await followupApi.uploadEmailFlowAsset(file);
      if (kind === "logo") onChange({ ...layout, logoUrl: url });
      else if (blockIndex !== undefined) setBlock(blockIndex, { src: url });
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Upload fallito");
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Logo (URL https in whitelist)</span>
            <DroppableField
              value={layout.logoUrl}
              onChange={(logoUrl) => onChange({ ...layout, logoUrl })}
              placeholder="https://..."
            />
            <input
              ref={fileLogo}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, "logo");
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => fileLogo.current?.click()}>
              Carica logo (S3)
            </Button>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Colore primario</span>
            <div className="flex gap-2">
              <Input
                type="color"
                className="h-9 w-14 cursor-pointer p-1"
                value={layout.primaryColor}
                onChange={(e) => onChange({ ...layout, primaryColor: e.target.value })}
              />
              <Input
                value={layout.primaryColor}
                onChange={(e) => onChange({ ...layout, primaryColor: e.target.value })}
                className="font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {layout.blocks.map((block, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {block.type === "heading" && "Titolo"}
                  {block.type === "text" && "Testo"}
                  {block.type === "button" && "Pulsante"}
                  {block.type === "image" && "Immagine"}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => removeBlock(i)}>
                  Rimuovi
                </Button>
              </div>
              {block.type === "heading" ? (
                <DroppableField value={block.text} onChange={(text) => setBlock(i, { text })} />
              ) : null}
              {block.type === "text" ? (
                <DroppableField value={block.text} onChange={(text) => setBlock(i, { text })} multiline />
              ) : null}
              {block.type === "button" ? (
                <div className="space-y-2">
                  <DroppableField
                    value={block.label}
                    onChange={(label) => setBlock(i, { label })}
                    placeholder="Etichetta"
                  />
                  <DroppableField
                    value={block.href}
                    onChange={(href) => setBlock(i, { href })}
                    placeholder="{{inviteLink}} o URL https"
                    className="font-mono text-xs"
                  />
                </div>
              ) : null}
              {block.type === "image" ? (
                <div className="space-y-2">
                  <DroppableField
                    value={block.src}
                    onChange={(src) => setBlock(i, { src })}
                    placeholder="URL immagine (https whitelist)"
                    className="font-mono text-xs"
                  />
                  <DroppableField value={block.alt} onChange={(alt) => setBlock(i, { alt })} placeholder="Alt" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="text-xs"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f, "image", i);
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("heading")}>
            + Titolo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("text")}>
            + Testo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("button")}>
            + Pulsante
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("image")}>
            + Immagine
          </Button>
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 lg:w-44">
        <p className="text-xs font-semibold text-foreground">Variabili</p>
        <p className="text-[11px] text-muted-foreground">Trascina in un campo testo.</p>
        <div className="flex flex-col gap-1.5">
          {placeholders.map((p) => (
            <span
              key={p}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `{{${p}}}`);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="cursor-grab rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs shadow-sm active:cursor-grabbing"
            >
              {`{{${p}}}`}
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}
