import * as React from "react";
import { render as rtlRender, screen, fireEvent, within, waitFor, type RenderOptions } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

export { describe, it, expect, vi, screen, fireEvent, within, userEvent, waitFor };

type WrapperProps = { children: React.ReactNode };

function defaultWrapper({ children }: WrapperProps) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

export interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  wrapper?: React.ComponentType<WrapperProps>;
}

export function render(
  ui: React.ReactElement,
  { wrapper: Wrapper = defaultWrapper, ...options }: CustomRenderOptions = {}
) {
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

type MockWorkspaceProject = { id: string; name: string; displayName?: string };

/** Default allineato a `useWorkspace()` in projectScope — usa nei `vi.mock("../../auth/projectScope")`. */
export function mockUseWorkspace(overrides: {
  workspaceId?: string;
  selectedProjectIds?: string[];
  projects?: MockWorkspaceProject[];
  email?: string;
  isAdmin?: boolean;
  permissions?: string[];
  hasPermission?: (perm: string) => boolean;
  isTecmaAdmin?: boolean;
} = {}) {
  const { hasPermission: hasPermissionOverride, ...rest } = overrides;
  const permissionsExplicit = Object.prototype.hasOwnProperty.call(overrides, "permissions");
  const defaults = {
    workspaceId: "",
    selectedProjectIds: [] as string[],
    projects: [] as MockWorkspaceProject[],
    email: "",
    isAdmin: false,
    permissions: [] as string[],
    isTecmaAdmin: false,
  };
  const merged = { ...defaults, ...rest };
  const hasPermission =
    typeof hasPermissionOverride === "function"
      ? hasPermissionOverride
      : (perm: string): boolean => {
          if (merged.isAdmin) return true;
          if (!permissionsExplicit) return true;
          if (merged.permissions.includes("*")) return true;
          return merged.permissions.includes(perm);
        };
  return { ...merged, hasPermission };
}
