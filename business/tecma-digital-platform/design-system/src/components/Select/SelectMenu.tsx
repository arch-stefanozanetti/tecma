import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  Ref,
} from "react";
import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export function SelectMenu({
  children,
  className,
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn("tecma-select-menu", className)}
      style={style}
      role="presentation"
    >
      {children}
    </div>
  );
}

export function SelectMenuSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("tecma-select-menu__section", className)}>{children}</div>
  );
}

export function SelectMenuToolbar({
  children,
  end,
  className,
}: {
  children: ReactNode;
  end?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "tecma-select-menu__toolbar",
        end && "tecma-select-menu__toolbar--end",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectMenuLink({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("tecma-select-menu__link", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SelectMenuAddRow({
  label,
  onAdd,
  addLabel = "Aggiungi",
}: {
  label: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="tecma-select-menu__add-row">
      <SelectMenuLink type="button">{label}</SelectMenuLink>
      <button
        type="button"
        className="tecma-select-menu__icon-btn"
        aria-label={addLabel}
        onClick={onAdd}
      >
        <Icon name="plus" size="sm" />
      </button>
    </div>
  );
}

export function SelectMenuSearch({
  placeholder = "Cerca…",
  value,
  onChange,
  onClear,
  inputRef,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  onClear?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="tecma-select-menu__search">
      <div className="tecma-select-menu__search-inner">
        <Icon name="search" size="sm" />
        <input
          ref={inputRef}
          type="search"
          className="tecma-select-menu__search-input"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          {...rest}
        />
        {value ? (
          <button
            type="button"
            className="tecma-select-menu__icon-btn"
            aria-label="Cancella"
            onClick={onClear}
          >
            <Icon name="x" size="sm" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SelectMenuList({ children }: { children: ReactNode }) {
  return (
    <div className="tecma-select-menu__scroll" role="listbox">
      {children}
    </div>
  );
}
