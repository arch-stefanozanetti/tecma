import {
  useCallback,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export type AccordionVariant = "flat" | "border";

export interface AccordionFooterLink {
  label: string;
  onClick: () => void;
}

export interface AccordionItemProps {
  title: string;
  variant?: AccordionVariant;
  disabled?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  footerLink?: AccordionFooterLink;
  className?: string;
}

export function AccordionItem({
  title,
  variant = "flat",
  disabled = false,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  children,
  footerLink,
  className,
}: AccordionItemProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  const contentId = useId();
  const headerId = useId();

  const toggle = () => {
    if (disabled) return;
    setOpen(!open);
  };

  const rootClass = cn(
    "tecma-accordion",
    variant === "border" && "tecma-accordion--border",
    variant === "flat" && "tecma-accordion--flat",
    open && "tecma-accordion--open",
    disabled && "tecma-accordion--disabled",
    className
  );

  const headingClass = cn(
    "tecma-accordion__heading",
    variant === "border" && "tecma-accordion__heading--border",
    variant === "flat" && "tecma-accordion__heading--flat"
  );

  const chevronName =
    disabled || !open ? ("chevron-down" as const) : ("chevron-up" as const);

  return (
    <div className={rootClass}>
      <div className="tecma-accordion__header">
        <span id={headerId} className={cn(headingClass, "tecma-accordion__title")}>
          {title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          disabled={disabled}
          className="tecma-accordion__chevron"
          aria-expanded={disabled ? undefined : open}
          aria-controls={disabled ? undefined : contentId}
          aria-label={
            disabled
              ? undefined
              : open
                ? `Comprimi: ${title}`
                : `Espandi: ${title}`
          }
          onClick={disabled ? undefined : toggle}
        >
          <Icon name={chevronName} size="sm" />
        </Button>
      </div>
      {open && !disabled && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          className="tecma-accordion__panel"
        >
          {children != null && (
            <div className="tecma-accordion__body">{children}</div>
          )}
          {footerLink && (
            <div className="tecma-accordion__footer">
              <button
                type="button"
                className="tecma-accordion__footer-link"
                onClick={footerLink.onClick}
              >
                {footerLink.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
