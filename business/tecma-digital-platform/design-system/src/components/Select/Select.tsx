import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SelectTrigger, type SelectTriggerSize } from "./SelectTrigger";
import { SelectItem } from "./SelectItem";
import {
  SelectMenu,
  SelectMenuList,
} from "./SelectMenu";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  size?: SelectTriggerSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Più valori + voci con checkbox a sinistra */
  multiselect?: boolean;
  className?: string;
  /** Larghezza massima trigger + menu */
  maxWidth?: string | number;
}

/**
 * Select composto — atomi: `SelectTrigger`, `SelectItem`, `SelectMenu/*`.
 * Figma: 300:7666 (campo), 5057:1587 (menu), 5057:1604 (voci).
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = "Placeholder",
  size = "md",
  invalid,
  disabled,
  readOnly,
  multiselect = false,
  className,
  maxWidth = "15rem",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled && !readOnly) setOpen((o) => !o);
  }, [disabled, readOnly]);

  const single = !multiselect;
  const selectedArr = single
    ? typeof value === "string"
      ? [value]
      : []
    : Array.isArray(value)
      ? value
      : [];

  const display: ReactNode = (() => {
    if (single && typeof value === "string" && value) {
      return options.find((o) => o.value === value)?.label ?? value;
    }
    if (!single && selectedArr.length > 0) {
      if (selectedArr.length === 1) {
        return options.find((o) => o.value === selectedArr[0])?.label ?? "";
      }
      return `${selectedArr.length} selezionati`;
    }
    return null;
  })();

  const handlePick = (v: string, optDisabled?: boolean) => {
    if (optDisabled || disabled || readOnly) return;
    if (single) {
      onChange(v);
      setOpen(false);
    } else {
      const arr = selectedArr;
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      onChange(next);
    }
  };

  const mw =
    typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", width: "100%", maxWidth: mw }}
    >
      <SelectTrigger
        size={size}
        placeholder={placeholder}
        invalid={invalid}
        disabled={disabled}
        readOnly={readOnly}
        open={open}
        onClick={toggle}
        aria-controls={listId}
      >
        {display}
      </SelectTrigger>
      {open ? (
        <SelectMenu id={listId} style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 50 }}>
          <SelectMenuList>
            {options.map((opt) => (
              <SelectItem
                key={opt.value}
                layout={multiselect ? "checkboxStart" : "checkEnd"}
                selected={
                  single
                    ? value === opt.value
                    : selectedArr.includes(opt.value)
                }
                disabled={opt.disabled}
                onClick={() => handlePick(opt.value, opt.disabled)}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectMenuList>
        </SelectMenu>
      ) : null}
    </div>
  );
}
