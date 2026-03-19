import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Tag } from "../Tag";
import { SelectMenu, SelectMenuList } from "../Select/SelectMenu";
import { SelectItem } from "../Select/SelectItem";
import { cn } from "../../utils/cn";

export interface InlineEditMultiselectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineEditMultiselectProps {
  label?: string;
  value?: string[];
  options: InlineEditMultiselectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string[]) => void;
  className?: string;
  id?: string;
}

/**
 * Inline Edit — variante multiselect con tag. Read: tag pills; hover: bg + icon edit;
 * click apre dropdown con checkbox; selected = tag filled.
 * Figma: 10582:1450 (Inline Edit Multiselect).
 */
export function InlineEditMultiselect({
  label = "Field Label",
  value = [],
  options,
  placeholder = "Add text",
  disabled = false,
  onChange,
  className,
  id: idProp,
}: InlineEditMultiselectProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const uniqId = useRef(`tecma-inline-edit-multi-${Math.random().toString(36).slice(2, 9)}`).current;
  const id = idProp ?? uniqId;

  const selectedSet = new Set(value);
  const hasValue = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggleOption = (optValue: string) => {
    if (options.find((o) => o.value === optValue)?.disabled) return;
    const next = selectedSet.has(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange?.(next);
  };

  const showHover = hover && !open && !disabled;

  return (
    <div
      ref={wrapRef}
      className={cn("tecma-inline-edit", className)}
      data-name="inline-edit-multiselect"
      style={{ position: "relative" }}
    >
      {label && (
        <div className="tecma-inline-edit__label" id={`${id}-label`}>
          {label}
        </div>
      )}
      <div
        className={cn(
          "tecma-inline-edit__inline",
          showHover && "tecma-inline-edit__inline--hover",
          open && "tecma-inline-edit__inline--edit"
        )}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => !disabled && setOpen(true)}
        role="button"
        tabIndex={disabled ? undefined : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable
        aria-label={hasValue ? `${value.length} selezionati` : placeholder}
        aria-describedby={label ? `${id}-label` : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) setOpen((o) => !o);
          }
        }}
      >
        {hasValue ? (
          <div className="tecma-inline-edit__tags">
            {value.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <Tag
                  key={v}
                  variant="default"
                  appearance="outline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {opt?.label ?? v}
                </Tag>
              );
            })}
          </div>
        ) : (
          !open && (
            <span className="tecma-inline-edit__placeholder">{placeholder}</span>
          )
        )}
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
        {open && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-hidden
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <Icon name="chevron-down" size="sm" />
          </Button>
        )}
      </div>

      {open && (
        <div
          className="tecma-inline-edit__menu"
          role="listbox"
          id={`${id}-listbox`}
          aria-label={label || placeholder}
          aria-multiselectable
          onMouseDown={(e) => e.stopPropagation()}
        >
          <SelectMenu>
            <SelectMenuList>
              {options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  layout="checkboxStart"
                  selected={selectedSet.has(opt.value)}
                  disabled={opt.disabled}
                  onClick={() => toggleOption(opt.value)}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectMenuList>
          </SelectMenu>
        </div>
      )}
    </div>
  );
}
