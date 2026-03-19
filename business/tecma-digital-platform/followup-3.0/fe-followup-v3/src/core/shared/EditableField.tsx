import { useState, useRef, useEffect } from "react";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";

interface EditableFieldTextProps {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableFieldText({ value, onSave, placeholder, className, disabled }: EditableFieldTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (saving) return;
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
      setDraft(value);
    } catch {
      /* mantieni editing, errore gestito da onSave che chiama toastError */
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSave();
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void handleSave()}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className={cn("h-8 text-sm", className)}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring",
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
    >
      {value || placeholder || "—"}
    </button>
  );
}

interface EditableFieldSelectProps {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableFieldSelect({
  value,
  onSave,
  options,
  placeholder,
  className,
  disabled,
}: EditableFieldSelectProps) {
  const [editing, setEditing] = useState(false);

  const handleSave = (v: string) => {
    if (v !== value) void onSave(v);
    setEditing(false);
  };

  if (editing && !disabled) {
    return (
      <Select value={value} onValueChange={handleSave} onOpenChange={setEditing}>
        <SelectTrigger className={cn("h-8 text-sm", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const label = options.find((o) => o.value === value)?.label ?? value ?? placeholder ?? "—";
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring",
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
