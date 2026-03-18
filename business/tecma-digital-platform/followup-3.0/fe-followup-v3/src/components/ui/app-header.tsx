/**
 * App Header — DS Tecma Software Suite (Figma). Header [NEW] / Profile (9842-1846).
 * Header con profilo/dropdown: trigger utente, pannello con sezioni (Account), link, logout.
 */
import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, UserCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface AppHeaderProfileSection {
  title?: string;
  email?: string;
  items?: { label: string; icon?: React.ReactNode; onClick?: () => void; href?: string }[];
}

export interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Nome utente mostrato nel trigger (es. "Mario Rossi"). */
  userName: string;
  /** Email (mostrata nel pannello). */
  userEmail?: string;
  /** Sezioni del dropdown (es. Account con email + link "Cambia progetti", poi Esci). */
  profileSections?: AppHeaderProfileSection[];
  /** Callback logout (es. "Esci"). */
  onLogout?: () => void;
  /** Contenuto aggiuntivo a sinistra del profilo (es. selector progetti, settings). */
  leftContent?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  userName,
  userEmail,
  profileSections = [],
  onLogout,
  leftContent,
  className,
  ...props
}: AppHeaderProps) {
  const defaultSections: AppHeaderProfileSection[] = [
    {
      title: "Account",
      email: userEmail,
      items: onLogout
        ? [{ label: "Esci", onClick: onLogout }]
        : [],
    },
    ...profileSections,
  ];
  const raw = profileSections.length > 0 ? profileSections : defaultSections;
  const sections = raw.map((s, i) =>
    i === 0 && userEmail && !s.email ? { ...s, email: userEmail } : s
  );

  return (
    <header
      className={cn(
        "relative z-20 flex h-[72px] items-center justify-end border-b border-border bg-background px-4 lg:px-6",
        className
      )}
      {...props}
    >
      <div className="flex w-full items-center justify-end gap-3">
        {leftContent}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-chrome border px-3 text-sm transition-colors",
                "border-border bg-background text-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-label="Menu profilo"
            >
              <UserCircle className="h-5 w-5 shrink-0" />
              <span className="max-w-[160px] truncate">{userName}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                "z-50 min-w-[16rem] overflow-hidden rounded-ui border border-border bg-card shadow-dropdown",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
              )}
            >
              {sections.map((section, i) => (
                <React.Fragment key={i}>
                  <div className="border-b border-border px-4 py-2.5">
                    {section.title && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </span>
                    )}
                    {section.email && (
                      <p className="mt-1 truncate text-sm text-foreground" title={section.email}>
                        {section.email}
                      </p>
                    )}
                  </div>
                  <div className="py-1">
                    {section.items?.map((item, j) => {
                      if (item.href) {
                        return (
                          <DropdownMenu.Item asChild key={j}>
                            <a
                              href={item.href}
                              className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                            >
                              {item.icon}
                              {item.label}
                            </a>
                          </DropdownMenu.Item>
                        );
                      }
                      return (
                        <DropdownMenu.Item
                          key={j}
                          className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                          onSelect={(e) => {
                            item.onClick?.();
                            e.preventDefault();
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </DropdownMenu.Item>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
