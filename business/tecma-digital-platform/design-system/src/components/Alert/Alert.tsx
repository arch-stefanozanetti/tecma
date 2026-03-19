import { useId, type ReactNode } from "react";
import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export type AlertVariant =
  | "default"
  | "brand"
  | "informative"
  | "success"
  | "warning"
  | "error";

export type AlertActionPlacement = "titleEnd" | "below" | "besideDescription";

export interface AlertAction {
  label: string;
  onClick: () => void;
  /** Senza description → titleEnd. Con description → below o besideDescription */
  placement?: AlertActionPlacement;
}

export interface AlertProps {
  variant?: AlertVariant;
  title: string;
  description?: ReactNode;
  action?: AlertAction;
  onDismiss?: () => void;
  /** Mostra icona leading (default per variante) */
  showIcon?: boolean;
  icon?: ReactNode;
  className?: string;
  /** default: alert per error, status per altri */
  role?: "alert" | "status";
}

const defaultIcons: Record<AlertVariant, ReactNode> = {
  default: <Icon name="emoji-happy" size="lg" />,
  brand: <Icon name="emoji-happy" size="lg" />,
  informative: <Icon name="information-circle" size="lg" />,
  success: <Icon name="check-circle" size="lg" />,
  warning: <Icon name="exclamation" size="lg" />,
  error: <Icon name="x-circle" size="lg" />,
};

export function Alert({
  variant = "default",
  title,
  description,
  action,
  onDismiss,
  showIcon = true,
  icon,
  className,
  role,
}: AlertProps) {
  const titleId = useId();
  const descId = useId();
  const hasDesc =
    description !== undefined &&
    description !== null &&
    description !== false &&
    !(typeof description === "string" && description.trim() === "");

  let actionPlacement = action?.placement;
  if (action && actionPlacement === undefined) {
    actionPlacement = hasDesc ? "below" : "titleEnd";
  }
  if (hasDesc && actionPlacement === "titleEnd") {
    actionPlacement = "below";
  }

  const rootRole = role ?? (variant === "error" ? "alert" : "status");

  const actionBtn = action && (
    <button
      type="button"
      className="tecma-alert__action"
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );

  const dismissBtn = onDismiss && (
    <button
      type="button"
      className="tecma-alert__dismiss"
      onClick={onDismiss}
      aria-label="Chiudi"
    >
      <Icon name="x" size="md" />
    </button>
  );

  const leadIcon =
    showIcon && (
      <span className="tecma-alert__icon">{icon ?? defaultIcons[variant]}</span>
    );

  const titleEl = (
    <p className="tecma-alert__title" id={titleId}>
      {title}
    </p>
  );

  return (
    <div
      className={cn("tecma-alert", `tecma-alert--${variant}`, className)}
      role={rootRole}
      aria-labelledby={titleId}
      aria-describedby={hasDesc ? descId : undefined}
    >
      {!hasDesc ? (
        <div className="tecma-alert__inner tecma-alert__inner--single">
          {leadIcon}
          <div className="tecma-alert__main tecma-alert__main--row">
            {titleEl}
            {actionPlacement === "titleEnd" && actionBtn}
          </div>
          {dismissBtn}
        </div>
      ) : (
        <div className="tecma-alert__inner tecma-alert__inner--stack">
          {leadIcon}
          <div className="tecma-alert__main tecma-alert__main--stack">
            {titleEl}
            {actionPlacement === "besideDescription" ? (
              <div className="tecma-alert__desc-row">
                <div className="tecma-alert__description" id={descId}>
                  {description}
                </div>
                {actionBtn}
              </div>
            ) : (
              <>
                <div className="tecma-alert__description" id={descId}>
                  {description}
                </div>
                {actionPlacement === "below" && actionBtn && (
                  <div className="tecma-alert__action-wrap">{actionBtn}</div>
                )}
              </>
            )}
          </div>
          {dismissBtn}
        </div>
      )}
    </div>
  );
}
