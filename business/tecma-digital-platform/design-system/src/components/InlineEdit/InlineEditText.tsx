import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export interface InlineEditTextProps {
  /** Etichetta sopra il campo */
  label?: string;
  /** Valore attuale (controllato) */
  value?: string;
  /** Placeholder quando vuoto (es. "Add text") */
  placeholder?: string;
  /** Messaggio di errore sotto l'input (attiva stato error) */
  errorMessage?: string;
  /** Disabilitato */
  disabled?: boolean;
  /** Callback al conferma modifica */
  onSave?: (value: string) => void;
  /** Callback annulla (opzionale) */
  onCancel?: () => void;
  /** Contenuto custom in edit (es. bottoni); se non passato usa Cancel + Confirm */
  renderActions?: (props: { onConfirm: () => void; onCancel: () => void }) => ReactNode;
  className?: string;
  /** id per associare label (accessibilità) */
  id?: string;
}

/**
 * Inline Edit — variante testo. Stati: default (placeholder), hover (bg + icon edit),
 * editing (input + cancel/confirm), error (bordo rosso + messaggio), filled (valore salvato).
 * Figma: 10579:7431 (Text Input), 10689:3244 (Text Area).
 */
export function InlineEditText({
  label = "Field Label",
  value: controlledValue = "",
  placeholder = "Add text",
  errorMessage,
  disabled = false,
  onSave,
  onCancel,
  renderActions,
  className,
  id: idProp,
}: InlineEditTextProps) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [localValue, setLocalValue] = useState(controlledValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqId = useRef(`tecma-inline-edit-${Math.random().toString(36).slice(2, 9)}`).current;
  const id = idProp ?? uniqId;

  const value = controlledValue;
  const hasValue = value.trim() !== "";
  const isEditing = editing && !disabled;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const closeOnClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setLocalValue(value);
        setEditing(false);
        setHover(false);
        onCancel?.();
      }
    };
    document.addEventListener("mousedown", closeOnClickOutside);
    return () => document.removeEventListener("mousedown", closeOnClickOutside);
  }, [isEditing, value, onCancel]);

  const handleStartEdit = useCallback(() => {
    if (disabled) return;
    setEditing(true);
    setLocalValue(value);
  }, [disabled, value]);

  const handleConfirm = useCallback(() => {
    const next = localValue.trim();
    onSave?.(next);
    setEditing(false);
    setHover(false);
  }, [localValue, onSave]);

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    setEditing(false);
    setHover(false);
    onCancel?.();
  }, [value, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      handleConfirm();
    },
    [handleConfirm]
  );

  const showHover = hover && !isEditing && !disabled;
  const hasError = Boolean(errorMessage);

  return (
    <div ref={containerRef} className={cn("tecma-inline-edit", className)} data-name="inline-edit-text">
      {label && (
        <div className="tecma-inline-edit__label" id={`${id}-label`}>
          {label}
        </div>
      )}
      {!isEditing && (
        <div
          className={cn(
            "tecma-inline-edit__inline",
            showHover && "tecma-inline-edit__inline--hover"
          )}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={handleStartEdit}
          role="button"
          tabIndex={disabled ? undefined : 0}
          aria-label={hasValue ? value : placeholder}
          aria-describedby={label ? `${id}-label` : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStartEdit();
            }
          }}
        >
          {hasValue ? (
            <span className="tecma-inline-edit__value" style={{ border: "none", background: "none" }}>
              {value}
            </span>
          ) : (
            <span className="tecma-inline-edit__placeholder">{placeholder}</span>
          )}
          {showHover && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Modifica"
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
            >
              <Icon name="pencil-alt" size="sm" />
            </Button>
          )}
        </div>
      )}

      {(isEditing || hasError) && (
        <form onSubmit={handleSubmit} className="tecma-inline-edit" style={{ width: "100%" }}>
          <div className="tecma-inline-edit__edit-row">
            <div
              className={cn(
                "tecma-inline-edit__inline",
                "tecma-inline-edit__inline--edit",
                hasError && "tecma-inline-edit__inline--error"
              )}
            >
              <input
                ref={inputRef}
                id={id}
                type="text"
                className="tecma-inline-edit__value"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={hasError}
                aria-describedby={hasError ? `${id}-error` : label ? `${id}-label` : undefined}
                aria-label={label || placeholder}
              />
              {hasError && (
                <span className="tecma-inline-edit__icon-indicator" aria-hidden>
                  <Icon name="exclamation-circle" size="sm" />
                </span>
              )}
            </div>
            {!renderActions ? (
              <div className="tecma-inline-edit__actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={handleCancel}
                  aria-label="Annulla"
                >
                  <Icon name="x" size="sm" />
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  iconOnly
                  aria-label="Conferma"
                >
                  <Icon name="check" size="sm" />
                </Button>
              </div>
            ) : (
              renderActions({ onConfirm: handleConfirm, onCancel: handleCancel })
            )}
          </div>
          {errorMessage && (
            <div id={`${id}-error`} className="tecma-inline-edit__error" role="alert">
              {errorMessage}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
