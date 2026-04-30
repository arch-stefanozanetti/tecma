import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Input } from "../../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };
type Kind = "string" | "number" | "boolean" | "object" | "array" | "null";

const detectKind = (v: JsonLike): Kind => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  switch (typeof v) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "object";
  }
};

const defaultFor = (k: Kind): JsonLike => {
  switch (k) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
};

type NodeProps = {
  value: JsonLike;
  onChange: (next: JsonLike) => void;
  depth?: number;
};

const NodeEditor = ({ value, onChange, depth = 0 }: NodeProps) => {
  const kind = detectKind(value);
  const pad = `ml-${Math.min(depth * 2, 8)}`;

  if (kind === "string") {
    return <Input value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />;
  }
  if (kind === "number") {
    return (
      <Input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="h-8 text-xs"
      />
    );
  }
  if (kind === "boolean") {
    return <Checkbox checked={Boolean(value)} onCheckedChange={(v) => onChange(Boolean(v))} />;
  }
  if (kind === "null") {
    return <span className="text-xs text-muted-foreground">null</span>;
  }
  if (kind === "array") {
    const arr = value as JsonLike[];
    return (
      <div className={`space-y-2 ${pad}`}>
        {arr.map((item, idx) => (
          <div key={`arr-${idx}`} className="rounded border border-border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Elemento {idx + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(arr.filter((_, i) => i !== idx))}
              >
                Rimuovi
              </Button>
            </div>
            <NodeEditor
              value={item}
              depth={depth + 1}
              onChange={(next) => {
                const clone = [...arr];
                clone[idx] = next;
                onChange(clone);
              }}
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arr, ""])}>
            + string
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arr, 0])}>
            + number
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arr, false])}>
            + boolean
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arr, {}])}>
            + object
          </Button>
        </div>
      </div>
    );
  }

  const obj = value as Record<string, JsonLike>;
  const entries = Object.entries(obj);
  return (
    <div className={`space-y-2 ${pad}`}>
      {entries.map(([key, val]) => (
        <div key={key} className="rounded border border-border p-2">
          <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2">
            <Input
              value={key}
              className="h-8 font-mono text-xs"
              onChange={(e) => {
                const nk = e.target.value;
                if (!nk || nk === key) return;
                const clone = { ...obj } as Record<string, JsonLike>;
                delete clone[key];
                clone[nk] = val;
                onChange(clone);
              }}
            />
            <Select
              value={detectKind(val)}
              onValueChange={(v) => {
                const clone = { ...obj } as Record<string, JsonLike>;
                clone[key] = defaultFor(v as Kind);
                onChange(clone);
              }}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="number">number</SelectItem>
                <SelectItem value="boolean">boolean</SelectItem>
                <SelectItem value="object">object</SelectItem>
                <SelectItem value="array">array</SelectItem>
                <SelectItem value="null">null</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const clone = { ...obj };
                delete clone[key];
                onChange(clone);
              }}
            >
              Rimuovi
            </Button>
          </div>
          <NodeEditor
            value={val}
            depth={depth + 1}
            onChange={(next) => {
              const clone = { ...obj } as Record<string, JsonLike>;
              clone[key] = next;
              onChange(clone);
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let key = "newKey";
          let i = 1;
          while (Object.prototype.hasOwnProperty.call(obj, key)) {
            key = `newKey${i++}`;
          }
          onChange({ ...(obj as Record<string, JsonLike>), [key]: "" });
        }}
      >
        Aggiungi campo
      </Button>
    </div>
  );
};

export const NestedValueEditor = ({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) => (
  <NodeEditor value={(value ?? {}) as JsonLike} onChange={(next) => onChange((next as Record<string, unknown>) ?? {})} />
);

