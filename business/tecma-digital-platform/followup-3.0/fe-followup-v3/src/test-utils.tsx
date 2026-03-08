/**
 * Utilità condivise per i test (DRY).
 * Re-export di Vitest e Testing Library; estendere customRender con wrapper (es. ThemeProvider) se necessario.
 */
import * as React from "react";
import {
  render as rtlRender,
  screen,
  fireEvent,
  within,
  type RenderOptions,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";

export { describe, it, expect, vi, screen, fireEvent, within, userEvent };

type WrapperProps = { children: React.ReactNode };

function defaultWrapper({ children }: WrapperProps) {
  return <>{children}</>;
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
