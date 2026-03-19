import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { SelectMenu, SelectMenuList } from "../Select/SelectMenu";
import { SelectItem } from "../Select/SelectItem";
import { cn } from "../../utils/cn";

export interface InlineEditSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineEditSelectProps {
  label?: string;
  value?: string;
  options: InlineEditSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
}

/**
 * Inline Edit — variante single select. Read: valore o placeholder; hover: bg + icon edit;
 * click apre dropdown (stato "Typing"); selected = filled.
 * Figma: 10579:7465 (Inline Edit Select).
 */
export function InlineEditSelect({
  label = "Field Label",
  value = "",
  options,
  placeholder = "Add text",
  disabled = false,
  onChange,
  className,
  id: idProp,
}: InlineEditSelectProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const uniqId = useRef(`tecma-inline-edit-select-${Math.random().toString(36).slice(2, 9)}`).current;
  const id = idProp ?? uniqId;

  const hasValue = value.trim() !== "";
  const displayLabel = hasValue
    ? (options.find((o) => o.value === value)?.label ?? value)
    : placeholder;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const showHover = hover && !open && !disabled;

  return (
    <div
      ref={wrapRef}
      className={cn("tecma-inline-edit", className)}
      data-name="inline-edit-select"
      style={{ position: "relative" }}
    >
      {label && (
        <div className="tecma-inline-edit__label" id={`${id}-label`}>
          {label}
        </div>
      )}
      {!open ? (
        <div
          className={cn(
            "tecma-inline-edit__inline",
            showHover && "tecma-inline-edit__inline--hover"
          )}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => !disabled && setOpen(true)}
          role="button"
          tabIndex={disabled ? undefined : 0}
          aria-haspopup="listbox"
          aria-expanded={false}
          aria-label={displayLabel}
          aria-describedby={label ? `${id}-label` : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) setOpen(true);
            }
          }}
        >
          <span
            className={cn(
              hasValue ? "tecma-inline-edit__value" : "tecma-inline-edit__placeholder"
            )}
            style={hasValue ? { border: "none", background: "none" } : undefined}
          >
            {displayLabel}
          </span>
          {showHover && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-hidden
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) setOpen(true);
              }}
            >
              <Icon name="pencil-alt" size="sm" />
            </Button>
          )}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "tecma-inline-edit__inline",
              "tecma-inline-edit__inline--edit"
            )}
            style={{ cursor: "pointer" }}
            onClick={() => setOpen(false)}
            role="button"
            tabIndex={0}
            aria-expanded={true}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <span
              className={cn(
                hasValue ? "tecma-inline-edit__value" : "tecma-inline-edit__placeholder"
              )}
              style={{ flex: 1, border: "none", background: "none" }}
            >
              {displayLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-hidden
              onClick={() => setOpen(false)}
            >
              <Icon name="chevron-down" size="sm" />
            </Button>
          </div>
          <div
            className="tecma-inline-edit__menu"
            role="listbox"
            id={`${id}-listbox`}
            aria-label={label || placeholder}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SelectMenu>
              <SelectMenuList>
                {options.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    layout="checkEnd"
                    selected={value === opt.value}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange?.(opt.value);
                        setOpen(false);
                      }
                    }}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectMenuList>
            </SelectMenu>
          </div>
        </>
      )}
    </div>
  );
}
