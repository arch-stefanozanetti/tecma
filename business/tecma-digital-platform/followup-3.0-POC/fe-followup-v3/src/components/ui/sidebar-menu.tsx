/**
 * Sidebar Menu — DS Tecma Software Suite (Figma).
 * Menu Single Item (9855-7477), Submenu (9855-7521), Menu Sidebar (9855-7248).
 */
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SidebarMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  subcontent?: React.ReactNode;
  showLabelWhenCollapsed?: boolean;
  collapsed?: boolean;
  active?: boolean;
}

export const SidebarMenuItem = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuItemProps
>(
  (
    {
      className,
      children,
      icon,
      subcontent,
      showLabelWhenCollapsed,
      collapsed,
      active,
      ...props
    },
    ref
  ) => {
    const showLabel = !collapsed || showLabelWhenCollapsed;
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "relative flex w-full items-center gap-3 rounded-chrome px-3 py-2.5 text-left text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          active && "bg-sidebar-accent text-primary shadow-sidebar-nav-active",
          !active && "text-sidebar-foreground",
          collapsed && "justify-center px-2",
          className
        )}
        {...props}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
            aria-hidden
          />
        )}
        {icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
        )}
        {showLabel && (
          <>
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {subcontent && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {subcontent}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);
SidebarMenuItem.displayName = "SidebarMenuItem";

export interface SidebarSubmenuProps {
  label: React.ReactNode;
  icon?: React.ReactNode;
  collapsed?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function SidebarSubmenu({
  label,
  icon,
  collapsed,
  open,
  onOpenChange,
  children,
  className,
}: SidebarSubmenuProps) {
  const showLabel = !collapsed;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-chrome px-3 py-2.5 text-left text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          "text-sidebar-foreground",
          collapsed && "justify-center px-2"
        )}
        aria-expanded={open}
      >
        {icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
        )}
        {showLabel && (
          <>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </>
        )}
      </button>
      {showLabel && open && (
        <div className="flex flex-col gap-0.5 pl-4">
          {children}
        </div>
      )}
    </div>
  );
}

export interface SidebarMenuProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  logo?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SidebarMenu({
  className,
  collapsed = false,
  onCollapsedChange,
  logo,
  children,
  footer,
  ...props
}: SidebarMenuProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar shadow-sidebar",
        "bg-gradient-to-b from-sidebar via-sidebar to-sidebar",
        collapsed ? "w-[72px]" : "w-[280px]",
        "transition-[width] duration-200",
        className
      )}
      {...props}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        {logo && <div className="flex min-w-0 flex-1 items-center overflow-hidden">{logo}</div>}
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chrome text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", collapsed ? "-rotate-90" : "rotate-90")}
            />
          </button>
        )}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {children}
      </nav>
      {footer && (
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3 text-center text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </aside>
  );
}
