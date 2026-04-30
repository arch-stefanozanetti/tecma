import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import {
  SidebarMenuItem,
  SidebarSubmenu,
  SidebarMenu,
} from "./sidebar-menu";

describe("SidebarMenuItem", () => {
  it("rende il label e risponde al click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SidebarMenuItem onClick={onClick}>Home</SidebarMenuItem>);
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /home/i }));
    expect(onClick).toHaveBeenCalled();
  });

  it("con active applica stato attivo", () => {
    render(<SidebarMenuItem active>Attivo</SidebarMenuItem>);
    const btn = screen.getByRole("button", { name: /attivo/i });
    expect(btn).toHaveClass("bg-sidebar-accent");
  });

  it("con collapsed nasconde il label se showLabelWhenCollapsed è false", () => {
    render(
      <SidebarMenuItem collapsed showLabelWhenCollapsed={false}>
        Nascosto
      </SidebarMenuItem>
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

describe("SidebarSubmenu", () => {
  it("apre/chiude al click e mostra children quando open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SidebarSubmenu
        label="Menu"
        open={false}
        onOpenChange={onOpenChange}
      >
        <SidebarMenuItem>Voce</SidebarMenuItem>
      </SidebarSubmenu>
    );
    const trigger = screen.getByRole("button", { name: /menu/i });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

describe("SidebarMenu", () => {
  it("rende aside con logo e children", () => {
    render(
      <SidebarMenu logo={<span>Logo</span>}>
        <SidebarMenuItem>Home</SidebarMenuItem>
      </SidebarMenu>
    );
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
  });

  it("mostra pulsante Espandi/Comprimi quando onCollapsedChange è fornito", async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render(
      <SidebarMenu onCollapsedChange={onCollapsedChange}>
        <SidebarMenuItem>Item</SidebarMenuItem>
      </SidebarMenu>
    );
    const toggle = screen.getByRole("button", { name: /comprimi menu/i });
    await user.click(toggle);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it("rende footer se fornito", () => {
    render(
      <SidebarMenu footer="Footer text">
        <SidebarMenuItem>Item</SidebarMenuItem>
      </SidebarMenu>
    );
    expect(screen.getByText("Footer text")).toBeInTheDocument();
  });
});
